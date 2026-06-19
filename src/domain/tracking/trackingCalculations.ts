import type { Coordinates, Evidence } from '../../core';
import type { CaminoService, CaminoStage, Monument, StagePoint, TrackingSample } from '..';

const earthRadiusKm = 6371;

const toRadians = (value: number): number => (value * Math.PI) / 180;

export const distanceKmBetween = (from: Coordinates, to: Coordinates): number => {
  const deltaLatitude = toRadians(to.latitude - from.latitude);
  const deltaLongitude = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);
  const haversine = Math.sin(deltaLatitude / 2) ** 2 + Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(deltaLongitude / 2) ** 2;

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(haversine));
};

export const calculateTrackedDistanceKm = (samples: TrackingSample[]): number => {
  if (samples.length < 2) return 0;

  return Number(samples.slice(1).reduce((sum, sample, index) => sum + distanceKmBetween(samples[index].coordinates, sample.coordinates), 0).toFixed(2));
};

export const calculateStageProgress = (stage: CaminoStage, completedDistanceKm: number) => {
  const totalDistanceKm = Math.max(stage.distanceKm, 0.1);
  const progressRatio = Math.max(0, Math.min(1, completedDistanceKm / totalDistanceKm));
  const remainingKm = Number(Math.max(0, totalDistanceKm - completedDistanceKm).toFixed(2));

  return {
    completedDistanceKm: Number(completedDistanceKm.toFixed(2)),
    remainingKm,
    progressRatio,
    progressPercent: Math.round(progressRatio * 100),
  };
};

export const estimateEtaMinutes = (remainingKm: number, averageSpeedKmh: number): number | undefined => {
  if (averageSpeedKmh <= 0) return undefined;

  return Math.round((remainingKm / averageSpeedKmh) * 60);
};

export const detectStageMilestones = (previousProgressRatio: number, currentProgressRatio: number): number[] => {
  const thresholds = [0.25, 0.5, 0.75, 1];

  return thresholds.filter((threshold) => previousProgressRatio < threshold && currentProgressRatio >= threshold).map((threshold) => Math.round(threshold * 100));
};

export type NearbyEntity = {
  id: string;
  title: string;
  type: 'service' | 'monument' | 'stagePoint';
  distanceKm: number;
  evidence: Evidence;
};

export const findNearbyEntities = ({
  origin,
  services,
  monuments,
  stagePoints,
  radiusKm,
  generatedAtIso,
}: {
  origin: Coordinates;
  services: CaminoService[];
  monuments: Monument[];
  stagePoints: StagePoint[];
  radiusKm: number;
  generatedAtIso: string;
}): NearbyEntity[] => {
  const evidence: Evidence = { sourceType: 'calculation', sourceId: 'nearby-detector', generatedAtIso, confidence: 'media' };
  const candidates: NearbyEntity[] = [
    ...services.filter((service) => service.coordinateStatus === 'verified' && service.coordinate).map((service) => ({
      id: service.id,
      title: service.title,
      type: 'service' as const,
      distanceKm: Number(distanceKmBetween(origin, service.coordinate!).toFixed(2)),
      evidence,
    })),
    ...monuments.filter((monument) => monument.coordinateStatus === 'verified' && monument.coordinate).map((monument) => ({
      id: monument.id,
      title: monument.title,
      type: 'monument' as const,
      distanceKm: Number(distanceKmBetween(origin, monument.coordinate!).toFixed(2)),
      evidence,
    })),
    ...stagePoints.filter((point) => point.coordinateStatus === 'verified' && point.coordinate).map((point) => ({
      id: point.id,
      title: point.title,
      type: 'stagePoint' as const,
      distanceKm: Number(distanceKmBetween(origin, point.coordinate!).toFixed(2)),
      evidence,
    })),
  ];

  return candidates.filter((candidate) => candidate.distanceKm <= radiusKm).sort((left, right) => left.distanceKm - right.distanceKm);
};
