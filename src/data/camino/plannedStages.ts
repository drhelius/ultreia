import { distance, length, lineSliceAlong, lineString } from '@turf/turf';
import type { CaminoStage } from '../../domain';
import type { StageGeometry } from './mapRepository';

export type PlannedStageDefinition = {
  day: number;
  startTown: string;
  endTown: string;
  parts: Array<{ stageSlug: string; fromKm: number; toKm: number }>;
};

const prefix = 'planned-v1:';

export const plannedStageSlug = (definition: PlannedStageDefinition): string => `${prefix}${encodeURIComponent(JSON.stringify(definition))}`;

export const parsePlannedStage = (slug: string): PlannedStageDefinition | undefined => {
  if (!slug.startsWith(prefix) || slug.length > 30000) return undefined;
  try {
    const definition = JSON.parse(decodeURIComponent(slug.slice(prefix.length))) as PlannedStageDefinition;
    if (!definition || !Number.isInteger(definition.day) || definition.day < 1 || typeof definition.startTown !== 'string' || !definition.startTown || typeof definition.endTown !== 'string' || !definition.endTown || !Array.isArray(definition.parts) || !definition.parts.length || definition.parts.length > 100) return undefined;
    if (definition.parts.some((part) => !part || typeof part.stageSlug !== 'string' || part.stageSlug.startsWith(prefix) || !Number.isFinite(part.fromKm) || !Number.isFinite(part.toKm) || part.fromKm < 0 || part.toKm <= part.fromKm)) return undefined;
    return definition;
  } catch {
    return undefined;
  }
};

export const buildPlannedStage = (slug: string, getStage: (slug: string) => CaminoStage | undefined, getGeometry: (slug: string) => StageGeometry | undefined): { stage: CaminoStage; geometry: StageGeometry } | undefined => {
  const definition = parsePlannedStage(slug);
  if (!definition) return undefined;
  const sources: CaminoStage[] = [];
  const coordinates: [number, number][] = [];
  for (const part of definition.parts) {
    const stage = getStage(part.stageSlug);
    const geometry = getGeometry(part.stageSlug);
    if (!stage || !geometry || (sources.length && (stage.routeSlug !== sources[0].routeSlug || stage.variantGroup !== sources[0].variantGroup))) return undefined;
    const line = lineString(geometry.coordinates);
    const totalKm = length(line);
    if (part.toKm > totalKm + .001 || part.fromKm >= totalKm) return undefined;
    const segment = lineSliceAlong(line, part.fromKm, Math.min(part.toKm, totalKm)).geometry.coordinates as [number, number][];
    if (coordinates.length && distance(coordinates[coordinates.length - 1], segment[0]) > .25) return undefined;
    coordinates.push(...segment);
    sources.push(stage);
  }
  const distanceKm = length(lineString(coordinates));
  const difficulty = sources.some((stage) => stage.difficulty === 'alta') ? 'alta' : sources.some((stage) => stage.difficulty === 'media') ? 'media' : 'baja';
  const first = sources[0];
  return {
    stage: { ...first, id: slug, slug, order: definition.day, title: `${definition.startTown} - ${definition.endTown}`, startTown: definition.startTown, endTown: definition.endTown, viaTowns: undefined, distanceKm: Number(distanceKm.toFixed(1)), estimatedMinutes: Math.round(distanceKm / (first.variantGroup === 'bici' ? 15 : 4.8) * 60), difficulty, hostelCount: 0, summary: 'Jornada personalizada sobre trazados del catalogo. La dificultad del terreno se conserva; disponibilidad de alojamiento no comprobada.' },
    geometry: { stageSlug: slug, routeSlug: first.routeSlug, relationId: getGeometry(definition.parts[0].stageSlug)!.relationId, distanceKm, coordinates },
  };
};