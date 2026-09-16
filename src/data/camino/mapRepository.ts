import type { CaminoService, CaminoTown } from '../../domain';
import { auditCampaignGeometry, auditStageGeometry, type StageMapAudit } from '../../domain/tracking/mapAudit';
import importedData from './mapData.json';
import corrections from './mapCorrections.json';
import { cyclingStagesTable, stagesTable, townsTable } from './tables';

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
const getStageAudit = (stageSlug: string): StageMapAudit => {
  const cached = auditByStage.get(stageSlug);
  if (cached) return cached;
  const stage = stagesBySlug.get(stageSlug);
  if (!stage) return { stageSlug, status: 'missing', issues: [{ code: 'unknown_stage', message: 'Etapa desconocida.' }] };
  const corrected = corrections.towns.filter((town) => town.routeSlugs.includes(stage.routeSlug)) as CaminoTown[];
  const correctedNames = new Set(corrected.map((town) => normalizedName(town.title)));
  const towns = [...corrected, ...townsTable.items.filter((town) => !correctedNames.has(normalizedName(town.title)))];
  const audit = auditStageGeometry(stage, geometryByStage.get(stageSlug), towns, data.routes.find((route) => route.routeSlug === stage.routeSlug)?.lines);
  auditByStage.set(stageSlug, audit);
  return audit;
};
const servicesByStage = new Map<string, CaminoService[]>();
for (const service of data.services) {
  if (!service.stageSlug) continue;
  const items = servicesByStage.get(service.stageSlug) ?? [];
  items.push(service);
  servicesByStage.set(service.stageSlug, items);
}

export const mapRepository = {
  getStageGeometry: (stageSlug: string) => geometryByStage.get(stageSlug),
  getStageAudit,
  getCampaignAudit: (stageSlugs: string[]) => auditCampaignGeometry(stageSlugs, getStageAudit, (slug) => geometryByStage.get(slug)),
  getServices: (stageSlug: string) => servicesByStage.get(stageSlug) ?? [],
  getAllServices: () => data.services,
  attribution: data.attribution,
  generatedAt: data.generatedAt,
};