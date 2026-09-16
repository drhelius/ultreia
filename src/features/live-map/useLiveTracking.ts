import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Location from 'expo-location';

import { systemClock, type Coordinates } from '../../core';
import { staticCaminoDataRepository } from '../../data/camino';
import type { ActiveJourney, CaminoStage, TrackingSample, TrackingSession } from '../../domain';
import { calculateStageProgress, calculateTrackedDistanceKm, estimateEtaMinutes, findNearbyEntities, type NearbyEntity } from '../../domain';
import { useLocalPersistence } from '../../persistence';
import { ExpoBatterySensor, ExpoLocationSensor } from '../../services';
import { mapRepository } from '../../data/camino/mapRepository';
import { positionOnRoute, progressOnRoute } from '../../domain/tracking/routeGeometry';

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
  totalKm?: number;
  elapsedMinutes?: number;
  deviationKm?: number;
  currentLocation?: Coordinates;
  locationStatus?: 'locating' | 'ready' | 'denied' | 'unavailable';
  locationError?: string;
};

const createId = (scope: string): string => `${scope}:${Date.now()}`;

export const useLiveTracking = (journey: ActiveJourney) => {
  const persistence = useLocalPersistence();
  const [state, setState] = useState<LiveTrackingState>({ samples: [], completedDistanceKm: 0, remainingKm: 0, progressPercent: 0, nearby: [] });
  const locationSensor = useMemo(() => new ExpoLocationSensor(), []);
  const batterySensor = useMemo(() => new ExpoBatterySensor(), []);
  const [simulationSpeed, setSimulationSpeed] = useState(5);
  const writing = useRef(false);
  const latestState = useRef(state);
  latestState.current = state;
  const deviceLocation = useRef<Coordinates | undefined>(undefined);
  const locationMode = useRef<'gps' | 'simulation'>('gps');
  const [initialized, setInitialized] = useState(false);
  const [locationStatus, setLocationStatus] = useState<LiveTrackingState['locationStatus']>('locating');
  const [locationError, setLocationError] = useState<string>();
  const refreshSequence = useRef(0);

  const refresh = useCallback(async () => {
    if (!persistence.repositories || !journey.activeStageSlug) return;
    const sequence = ++refreshSequence.current;

    const [activeStage, session] = await Promise.all([
      staticCaminoDataRepository.getStage(journey.activeStageSlug),
      persistence.repositories.trackingRepository.getActiveSession(journey.id),
    ]);
    const samples = session ? await persistence.repositories.trackingRepository.getSamples(session.id) : [];
    const geometry = mapRepository.getStageGeometry(journey.activeStageSlug);
    const totalKm = geometry?.distanceKm ?? activeStage?.distanceKm ?? 0;
    const completedDistanceKm = journey.status === 'completed' ? totalKm : samples.at(-1)?.routeProgressKm ?? calculateTrackedDistanceKm(samples);
    const progress = activeStage ? calculateStageProgress({ ...activeStage, distanceKm: totalKm }, completedDistanceKm) : { remainingKm: 0, progressPercent: 0 };
    const elapsedMinutes = session?.mode === 'simulation' ? completedDistanceKm / 4.8 * 60 : samples.length > 1 ? Math.max(0, (Date.parse(samples.at(-1)!.recordedAtIso) - Date.parse(samples[0].recordedAtIso)) / 60000) : 0;
    const averageSpeedKmh = elapsedMinutes > 0 ? completedDistanceKm / elapsedMinutes * 60 : 0;
    const etaMinutes = estimateEtaMinutes(progress.remainingKm, averageSpeedKmh);
    const latestSample = samples.at(-1);
    const currentLocation = session?.mode === 'simulation'
      ? latestSample?.coordinates ?? (geometry ? positionOnRoute(geometry.coordinates, 0) : undefined)
      : deviceLocation.current;
    const battery = await batterySensor.getBatterySnapshot().catch(() => undefined);

    let nearby: NearbyEntity[] = [];
    if (currentLocation && journey.activeStageSlug) {
      const [services, monuments, stagePoints] = await Promise.all([
        staticCaminoDataRepository.getServicesByStage(journey.activeStageSlug),
        staticCaminoDataRepository.getMonumentsByStage(journey.activeStageSlug),
        staticCaminoDataRepository.getStagePoints(journey.activeStageSlug),
      ]);
      nearby = findNearbyEntities({
        origin: currentLocation,
        services,
        monuments,
        stagePoints,
        radiusKm: 2,
        generatedAtIso: systemClock.nowIso(),
      }).slice(0, 8);
    }

    if (sequence !== refreshSequence.current) return;
    locationMode.current = session?.mode === 'simulation' ? 'simulation' : 'gps';
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
      totalKm,
      elapsedMinutes,
      deviationKm: geometry && currentLocation ? progressOnRoute(geometry.coordinates, currentLocation).deviationKm : undefined,
      currentLocation,
    });
    setInitialized(true);
  }, [batterySensor, journey.activeStageSlug, journey.id, journey.status, persistence.repositories]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const startTracking = useCallback(async () => {
    if (!persistence.repositories || !journey.activeStageSlug) return;
    if (await persistence.repositories.trackingRepository.getActiveSession(journey.id)) return;

    const nowIso = systemClock.nowIso();
    const session: TrackingSession = {
      id: createId('tracking-session'),
      journeyId: journey.id,
      stageSlug: journey.activeStageSlug,
      status: 'active',
      startedAtIso: nowIso,
      mode: 'gps',
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
    if (!persistence.repositories || !state.session || state.session.status !== 'active') return;

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
      routeProgressKm: journey.activeStageSlug && mapRepository.getStageGeometry(journey.activeStageSlug)
        ? progressOnRoute(mapRepository.getStageGeometry(journey.activeStageSlug)!.coordinates, location.coordinates).distanceKm : undefined,
    };

    await persistence.repositories.trackingRepository.addSample(sample);
    await refresh();
  }, [journey.activeStageSlug, locationSensor, persistence.repositories, refresh, state.session]);

  const advanceSimulation = useCallback(async (targetPercent?: number) => {
    const current = latestState.current;
    const session = current.session;
    const geometry = journey.activeStageSlug ? mapRepository.getStageGeometry(journey.activeStageSlug) : undefined;
    if (!persistence.repositories || !session || session.mode !== 'simulation' || !geometry || writing.current) return;
    if (session.status !== 'active' && targetPercent === undefined) return;
    writing.current = true;
    try {
      const nextKm = Math.min(geometry.distanceKm, targetPercent === undefined ? current.completedDistanceKm + 0.1 * simulationSpeed : Math.max(current.completedDistanceKm, geometry.distanceKm * targetPercent / 100));
      const nowIso = systemClock.nowIso();
      await persistence.repositories.trackingRepository.addSample({
        id: createId('simulation-sample'), sessionId: session.id, recordedAtIso: nowIso,
        coordinates: positionOnRoute(geometry.coordinates, nextKm), routeProgressKm: nextKm,
        evidence: { sourceType: 'user_input', sourceId: 'demo-simulator', confidence: 'alta', generatedAtIso: nowIso, simulated: true },
      });
      if (nextKm >= geometry.distanceKm) await persistence.repositories.trackingRepository.saveSession({ ...session, status: 'paused' });
      await refresh();
    } catch (error) {
      setState((currentState) => ({ ...currentState, lastError: error instanceof Error ? error.message : 'No se pudo avanzar.' }));
    } finally { writing.current = false; }
  }, [journey.activeStageSlug, persistence.repositories, refresh, simulationSpeed]);

  const startSimulation = useCallback(async () => {
    if (!persistence.repositories || !journey.activeStageSlug) return;
    const geometry = mapRepository.getStageGeometry(journey.activeStageSlug);
    if (!geometry) {
      setState((current) => ({ ...current, lastError: 'Esta etapa no tiene un trazado verificado para simular.' }));
      return;
    }
    const existing = await persistence.repositories.trackingRepository.getActiveSession(journey.id);
    if (existing) {
      if (existing.mode === 'simulation') await persistence.repositories.trackingRepository.saveSession({ ...existing, status: 'active' });
      else { setState((current) => ({ ...current, lastError: 'Finaliza el tracking GPS antes de simular.' })); return; }
      await refresh();
      return;
    }
    const nowIso = systemClock.nowIso();
    const session: TrackingSession = { id: createId('simulation'), journeyId: journey.id, stageSlug: journey.activeStageSlug, status: 'active', startedAtIso: nowIso, mode: 'simulation' };
    locationMode.current = 'simulation';
    await persistence.repositories.trackingRepository.saveSession(session);
    await persistence.repositories.trackingRepository.addSample({
      id: createId('simulation-start'), sessionId: session.id, recordedAtIso: nowIso,
      coordinates: positionOnRoute(geometry.coordinates, 0), routeProgressKm: 0,
      evidence: { sourceType: 'user_input', sourceId: 'demo-simulator', confidence: 'alta', generatedAtIso: nowIso, simulated: true },
    });
    await refresh();
  }, [journey.activeStageSlug, journey.id, persistence.repositories, refresh]);

  const advanceRef = useRef(advanceSimulation);
  advanceRef.current = advanceSimulation;
  useEffect(() => {
    if (state.session?.mode !== 'simulation' || state.session.status !== 'active') return;
    const timer = setInterval(() => void advanceRef.current(), 1000);
    return () => clearInterval(timer);
  }, [state.session?.id, state.session?.mode, state.session?.status]);

  useEffect(() => {
    if (!initialized || state.session?.mode === 'simulation') return;
    let disposed = false;
    let subscription: Location.LocationSubscription | undefined;
    const watch = async () => {
      setLocationStatus('locating');
      setLocationError(undefined);
      const permission = await Location.requestForegroundPermissionsAsync();
      if (disposed || locationMode.current === 'simulation') return;
      if (permission.status !== 'granted') {
        setLocationStatus('denied');
        setLocationError('Permiso de ubicacion desactivado. La simulacion sigue disponible.');
        return;
      }
      subscription = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, distanceInterval: 10, timeInterval: 5000 }, async (location) => {
        if (disposed || locationMode.current === 'simulation' || !persistence.repositories || (location.coords.accuracy ?? 0) > 100) return;
        const coordinates = { latitude: location.coords.latitude, longitude: location.coords.longitude };
        deviceLocation.current = coordinates;
        setLocationStatus('ready');
        setLocationError(undefined);
        if (writing.current) return;
        writing.current = true;
        try {
          const session = latestState.current.session;
          const nowIso = new Date(location.timestamp).toISOString();
          if (session?.status === 'active' && session.mode !== 'simulation') {
            const geometry = mapRepository.getStageGeometry(session.stageSlug);
            await persistence.repositories.trackingRepository.addSample({ id: createId('gps'), sessionId: session.id, recordedAtIso: nowIso, coordinates, accuracyMeters: location.coords.accuracy ?? undefined, routeProgressKm: geometry ? progressOnRoute(geometry.coordinates, coordinates).distanceKm : undefined, evidence: { sourceType: 'sensor', sourceId: 'gps', confidence: 'alta', generatedAtIso: nowIso } });
          }
          if (!disposed) await refresh();
        } catch (error) {
          if (!disposed) setState((current) => ({ ...current, lastError: error instanceof Error ? error.message : 'Error GPS' }));
        } finally { writing.current = false; }
      });
      if (disposed) subscription.remove();
    };
    void watch().catch((error) => {
      if (!disposed && locationMode.current !== 'simulation') {
        setLocationStatus('unavailable');
        setLocationError(error instanceof Error ? error.message : 'Ubicacion no disponible.');
      }
    });
    return () => { disposed = true; subscription?.remove(); };
  }, [initialized, state.session?.mode, persistence.repositories, refresh]);

  return {
    state: { ...state, locationStatus: state.session?.mode === 'simulation' && state.currentLocation ? 'ready' as const : locationStatus, locationError: state.session?.mode === 'simulation' ? undefined : locationError },
    startTracking,
    pauseTracking,
    resumeTracking,
    completeTracking,
    recordLocationSample,
    startSimulation,
    advanceSimulation,
    simulationSpeed,
    setSimulationSpeed,
    refresh,
  };
};
