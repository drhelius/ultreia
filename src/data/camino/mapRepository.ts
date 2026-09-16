import type { CaminoService, CaminoTown } from '../../domain';
import { auditCampaignGeometry, auditStageGeometry, type StageMapAudit } from '../../domain/tracking/mapAudit';
import importedData from './mapData.json';
import corrections from './mapCorrections.json';
import { cyclingStagesTable, stagesTable, townsTable } from './tables';
import { buildPlannedStage, parsePlannedStage } from './plannedStages';
import { lineString, nearestPointOnLine, point } from '@turf/turf';
import type { Coordinates } from '../../core';

export type StageGeometry = {
  stageSlug: string;
  routeSlug: string;
  relationId: number;
  distanceKm: number;
  coordinates: [number, number][];
};

type MapData = {
  generatedAt: string;
  attribution: string;
  routes: Array<{ routeSlug: string; lines: [number, number][][] }>;
  stages: StageGeometry[];
  services: CaminoService[];
  missingStages: string[];
};

const data = importedData as unknown as MapData;
const geometryByStage = new Map(data.stages.map((stage) => [stage.stageSlug, stage]));
const stagesBySlug = new Map([...stagesTable.items, ...cyclingStagesTable.items].map((stage) => [stage.slug, stage]));
const auditByStage = new Map<string, StageMapAudit>();
const normalizedName = (name: string) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const getStageDefinition = (slug: string) => {
  if (!stagesBySlug.has(slug)) {
    const planned = buildPlannedStage(slug, (source) => stagesBySlug.get(source), (source) => geometryByStage.get(source));
    if (planned) {
      stagesBySlug.set(slug, planned.stage);
      geometryByStage.set(slug, planned.geometry);
    }
  }
  return stagesBySlug.get(slug);
};
const getStageGeometry = (slug: string) => {
  getStageDefinition(slug);
  return geometryByStage.get(slug);
};
const getStageAudit = (stageSlug: string): StageMapAudit => {
  const cached = auditByStage.get(stageSlug);
  if (cached) return cached;
  const stage = getStageDefinition(stageSlug);
  if (!stage) return { stageSlug, status: 'missing', issues: [{ code: 'unknown_stage', message: 'Etapa desconocida.' }] };
  const planned = parsePlannedStage(stageSlug);
  if (planned?.parts.some((part) => getStageAudit(part.stageSlug).status !== 'verified')) return { stageSlug, status: 'review', issues: [{ code: 'unverified_source', message: 'Una etapa de origen no tiene trazado verificado.' }] };
  const corrected = corrections.towns.filter((town) => town.routeSlugs.includes(stage.routeSlug)) as CaminoTown[];
  const correctedNames = new Set(corrected.map((town) => normalizedName(town.title)));
  const towns = [...corrected, ...townsTable.items.filter((town) => !correctedNames.has(normalizedName(town.title)))];
  const audit = auditStageGeometry(stage, geometryByStage.get(stageSlug), towns, data.routes.find((route) => route.routeSlug === stage.routeSlug)?.lines);
  auditByStage.set(stageSlug, audit);
  return audit;
};
const servicesByStage = new Map<string, CaminoService[]>();
const plannedLines = new Map<string, ReturnType<typeof lineString>>();
const plannedBounds = new Map<string, { west: number; east: number; south: number; north: number }>();
const isOnStage = (stageSlug: string, coordinate: Coordinates | undefined): boolean => {
  if (!coordinate) return false;
  let line = plannedLines.get(stageSlug);
  if (!line) {
    const geometry = getStageGeometry(stageSlug);
    if (!geometry) return false;
    line = lineString(geometry.coordinates);
    plannedLines.set(stageSlug, line);
    plannedBounds.set(stageSlug, {
      west: Math.min(...geometry.coordinates.map((item) => item[0])) - .005,
      east: Math.max(...geometry.coordinates.map((item) => item[0])) + .005,
      south: Math.min(...geometry.coordinates.map((item) => item[1])) - .005,
      north: Math.max(...geometry.coordinates.map((item) => item[1])) + .005,
    });
  }
  const bounds = plannedBounds.get(stageSlug)!;
  if (coordinate.longitude < bounds.west || coordinate.longitude > bounds.east || coordinate.latitude < bounds.south || coordinate.latitude > bounds.north) return false;
  return nearestPointOnLine(line, point([coordinate.longitude, coordinate.latitude])).properties.dist <= .35;
};
for (const service of data.services) {
  if (!service.stageSlug) continue;
  const items = servicesByStage.get(service.stageSlug) ?? [];
  items.push(service);
  servicesByStage.set(service.stageSlug, items);
}
const getServices = (stageSlug: string): CaminoService[] => {
  const cached = servicesByStage.get(stageSlug);
  if (cached) return cached;
  const definition = parsePlannedStage(stageSlug);
  if (!definition) return [];
  const unique = new Map<string, CaminoService>();
  for (const part of definition.parts) {
    for (const service of servicesByStage.get(part.stageSlug) ?? []) {
      if (service.coordinateStatus === 'verified' && isOnStage(stageSlug, service.coordinate)) unique.set(service.geocoding?.placeId ?? service.id, { ...service, stageSlug });
    }
  }
  const services = [...unique.values()];
  servicesByStage.set(stageSlug, services);
  return services;
};

export const mapRepository = {
  getPlanningTowns: (routeSlug: string): CaminoTown[] => [...corrections.towns, ...townsTable.items].filter((town) => town.routeSlugs.includes(routeSlug) && town.coordinateStatus === 'verified' && town.coordinate && town.geocoding) as CaminoTown[],
  getStageGeometry,
  getStageDefinition,
  isOnStage,
  getStageAudit,
  getCampaignAudit: (stageSlugs: string[]) => auditCampaignGeometry(stageSlugs, getStageAudit, getStageGeometry),
  getServices,
  getAllServices: () => data.services,
  attribution: data.attribution,
  generatedAt: data.generatedAt,
};