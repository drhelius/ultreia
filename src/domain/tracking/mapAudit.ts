import { along, distance, length, lineString, nearestPointOnLine } from '@turf/turf';
import type { CaminoStage, CaminoTown } from '../camino';

export type AuditableGeometry = {
  stageSlug: string;
  routeSlug: string;
  distanceKm: number;
  coordinates: [number, number][];
};

export type MapAuditIssue = { code: string; message: string };
export type StageMapAudit = {
  stageSlug: string;
  status: 'verified' | 'missing' | 'review';
  issues: MapAuditIssue[];
  metrics?: { lengthKm: number; distanceDeviation: number; longestSegmentKm: number; startOffsetKm?: number; endOffsetKm?: number };
};
export type CampaignMapAudit = { ready: boolean; verifiedCount: number; totalCount: number; stages: StageMapAudit[]; issues: MapAuditIssue[] };

export const mapAuditPolicy = { maxDistanceDeviation: 0.25, maxEndpointOffsetKm: 1, maxSegmentKm: 1, maxStageGapKm: 0.25 } as const;

const townName = (value: string) => value.split('(')[0].normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\bcp\s*\d+\b/g, '').replace(/[^a-z0-9]+/g, ' ').trim().replace(/^(o|a) /, '');

export function auditStageGeometry(stage: CaminoStage, geometry: AuditableGeometry | undefined, towns: CaminoTown[], sourceLines: [number, number][][] = []): StageMapAudit {
  if (!geometry) return { stageSlug: stage.slug, status: 'missing', issues: [{ code: 'missing_geometry', message: 'Trazado pendiente de importar.' }] };
  const issues: MapAuditIssue[] = [];
  if (geometry.stageSlug !== stage.slug || geometry.routeSlug !== stage.routeSlug) issues.push({ code: 'wrong_reference', message: 'El trazado no corresponde a esta etapa y ruta.' });
  if (geometry.coordinates.length < 2 || geometry.coordinates.some((coordinate) => coordinate.length !== 2 || !coordinate.every(Number.isFinite) || Math.abs(coordinate[0]) > 180 || Math.abs(coordinate[1]) > 90)) {
    return { stageSlug: stage.slug, status: 'review', issues: [...issues, { code: 'invalid_coordinates', message: 'Coordenadas del trazado no validas.' }] };
  }
  const lengthKm = length(lineString(geometry.coordinates));
  const distanceDeviation = Math.abs(lengthKm - stage.distanceKm) / stage.distanceKm;
  const longestSegmentKm = geometry.coordinates.slice(1).reduce((longest, coordinate, index) => Math.max(longest, distance(geometry.coordinates[index], coordinate)), 0);
  if (!Number.isFinite(lengthKm) || lengthKm <= 0 || !Number.isFinite(stage.distanceKm) || stage.distanceKm <= 0 || distanceDeviation > mapAuditPolicy.maxDistanceDeviation) issues.push({ code: 'distance_mismatch', message: 'Distancia del trazado incoherente con la etapa del catalogo.' });
  if (!Number.isFinite(geometry.distanceKm) || Math.abs(lengthKm - geometry.distanceKm) > .1) issues.push({ code: 'stored_length_mismatch', message: 'La distancia guardada no coincide con la geometria.' });
  const sourceFeatures = sourceLines.filter((coordinates) => coordinates.length > 1).map((coordinates) => ({ line: lineString(coordinates), west: Math.min(...coordinates.map((coordinate) => coordinate[0])), east: Math.max(...coordinates.map((coordinate) => coordinate[0])), south: Math.min(...coordinates.map((coordinate) => coordinate[1])), north: Math.max(...coordinates.map((coordinate) => coordinate[1])) }));
  const unsupportedJump = geometry.coordinates.slice(1).some((coordinate, index) => {
    const start = geometry.coordinates[index]; const segmentKm = distance(start, coordinate);
    if (segmentKm <= mapAuditPolicy.maxSegmentKm) return false;
    const segment = lineString([start, coordinate]);
    for (let offset = 0; offset <= segmentKm; offset += .1) {
      const sample = along(segment, offset); const [longitude, latitude] = sample.geometry.coordinates;
      if (!sourceFeatures.some((source) => longitude >= source.west - .001 && longitude <= source.east + .001 && latitude >= source.south - .001 && latitude <= source.north + .001 && nearestPointOnLine(source.line, sample).properties.dist <= .02)) return true;
    }
    return false;
  });
  if (unsupportedJump) issues.push({ code: 'geometry_jump', message: 'Un segmento largo no esta respaldado por la geometria de origen.' });
  const endpointOffset = (name: string, coordinate: [number, number], endpoint: string) => {
    const candidates = towns.filter((town) => town.coordinateStatus === 'verified' && town.coordinate && town.geocoding && townName(town.title) === townName(name));
    if (!candidates.length) { issues.push({ code: `${endpoint}_unverified`, message: `No hay coordenadas verificadas para ${name}.` }); return undefined; }
    const offset = Math.min(...candidates.map((town) => distance(coordinate, [town.coordinate!.longitude, town.coordinate!.latitude])));
    if (offset > mapAuditPolicy.maxEndpointOffsetKm) issues.push({ code: `${endpoint}_mismatch`, message: `El extremo del trazado no coincide con ${name}.` });
    return offset;
  };
  const startOffsetKm = endpointOffset(stage.startTown, geometry.coordinates[0], 'start');
  const endOffsetKm = endpointOffset(stage.endTown, geometry.coordinates[geometry.coordinates.length - 1], 'end');
  return { stageSlug: stage.slug, status: issues.length ? 'review' : 'verified', issues, metrics: { lengthKm, distanceDeviation, longestSegmentKm, startOffsetKm, endOffsetKm } };
}

export function auditCampaignGeometry(stageSlugs: string[], getAudit: (slug: string) => StageMapAudit, getGeometry: (slug: string) => AuditableGeometry | undefined): CampaignMapAudit {
  const stages = stageSlugs.map(getAudit);
  const issues: MapAuditIssue[] = [];
  if (!stageSlugs.length) issues.push({ code: 'empty_campaign', message: 'La campana no tiene etapas.' });
  if (new Set(stageSlugs).size !== stageSlugs.length) issues.push({ code: 'duplicate_stage', message: 'La campana contiene etapas repetidas.' });
  for (let index = 1; index < stageSlugs.length; index++) {
    if (stages[index - 1].status !== 'verified' || stages[index].status !== 'verified') continue;
    const previous = getGeometry(stageSlugs[index - 1]);
    const next = getGeometry(stageSlugs[index]);
    if (!previous || !next) { issues.push({ code: 'missing_geometry', message: 'Una etapa validada ya no tiene trazado.' }); continue; }
    if (distance(previous.coordinates[previous.coordinates.length - 1], next.coordinates[0]) > mapAuditPolicy.maxStageGapKm) issues.push({ code: 'stage_gap', message: `Las etapas ${index} y ${index + 1} no enlazan: ${stageSlugs[index - 1]} / ${stageSlugs[index]}.` });
  }
  const verifiedCount = stages.filter((stage) => stage.status === 'verified').length;
  return { ready: stageSlugs.length > 0 && verifiedCount === stageSlugs.length && issues.length === 0, verifiedCount, totalCount: stageSlugs.length, stages, issues };
}