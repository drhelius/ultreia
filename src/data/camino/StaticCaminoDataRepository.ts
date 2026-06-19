import type { Evidence } from '../../core';
import type { SearchResult, TravelMode } from '../../domain';
import type {
  CaminoDataRepository,
  CampaignTemplate,
  QuestTemplate,
  SearchScope,
} from '../../repositories';
import {
  budgetProfilesTable,
  campaignTemplatesTable,
  cyclingStagesTable,
  hostelsTable,
  monumentsTable,
  questTemplatesTable,
  routesTable,
  servicesTable,
  stagePointsTable,
  stageSectionsTable,
  stagesTable,
  townsTable,
} from './tables';

const dataPackEvidence: Evidence = {
  sourceType: 'data_pack',
  sourceId: 'camino-data-pack',
  generatedAtIso: routesTable.generatedAt,
  confidence: 'alta',
};

const normalize = (value: string): string => value.trim().toLowerCase();

const includesText = (value: string | undefined, query: string): boolean => {
  if (!value) {
    return false;
  }

  return normalize(value).includes(query);
};

export class StaticCaminoDataRepository implements CaminoDataRepository {
  async getRoutes() {
    return routesTable.items;
  }

  async getRoute(routeSlug: string) {
    return routesTable.items.find((route) => route.slug === routeSlug);
  }

  async getStagesByRoute(routeSlug: string, mode: TravelMode = 'walk') {
    const stageItems = mode === 'bike' ? cyclingStagesTable.items : stagesTable.items;

    return stageItems.filter((stage) => stage.routeSlug === routeSlug).sort((left, right) => left.order - right.order);
  }

  async getStage(stageSlug: string) {
    return [...stagesTable.items, ...cyclingStagesTable.items].find((stage) => stage.slug === stageSlug);
  }

  async getTowns() {
    return townsTable.items;
  }

  async getTown(townSlug: string) {
    return townsTable.items.find((town) => town.slug === townSlug);
  }

  async getStageSections(stageSlug: string) {
    return stageSectionsTable.items.find((sections) => sections.stageSlug === stageSlug);
  }

  async getStagePoints(stageSlug: string) {
    return stagePointsTable.items.filter((point) => point.stageSlug === stageSlug);
  }

  async getHostelsByStage(stageSlug: string) {
    return hostelsTable.items.filter((hostel) => hostel.stageSlug === stageSlug);
  }

  async getMonumentsByStage(stageSlug: string) {
    return monumentsTable.items.filter((monument) => monument.stageSlug === stageSlug);
  }

  async getServicesByStage(stageSlug: string, types?: Parameters<CaminoDataRepository['getServicesByStage']>[1]) {
    return servicesTable.items.filter((service) => {
      const matchesStage = service.stageSlug === stageSlug;
      const matchesType = !types || types.includes(service.type);

      return matchesStage && matchesType;
    });
  }

  async searchByText(query: string, scope?: SearchScope) {
    const normalizedQuery = normalize(query);

    if (!normalizedQuery) {
      return [];
    }

    const results: SearchResult[] = [];

    for (const route of routesTable.items) {
      if (scope?.routeSlug && route.slug !== scope.routeSlug) {
        continue;
      }

      if (includesText(route.title, normalizedQuery) || includesText(route.subtitle, normalizedQuery)) {
        results.push({ id: route.id, type: 'route', title: route.title, subtitle: route.subtitle, evidence: dataPackEvidence });
      }
    }

    for (const stage of stagesTable.items) {
      if (scope?.routeSlug && stage.routeSlug !== scope.routeSlug) {
        continue;
      }
      if (scope?.stageSlug && stage.slug !== scope.stageSlug) {
        continue;
      }

      if (includesText(stage.title, normalizedQuery) || includesText(stage.summary, normalizedQuery)) {
        results.push({ id: stage.id, type: 'stage', title: stage.title, subtitle: stage.routeSlug, evidence: dataPackEvidence });
      }
    }

    for (const hostel of hostelsTable.items) {
      if (scope?.routeSlug && hostel.routeSlug !== scope.routeSlug) {
        continue;
      }
      if (scope?.stageSlug && hostel.stageSlug !== scope.stageSlug) {
        continue;
      }

      if (includesText(hostel.title, normalizedQuery) || includesText(hostel.town, normalizedQuery)) {
        results.push({ id: hostel.id, type: 'hostel', title: hostel.title, subtitle: hostel.town, evidence: dataPackEvidence });
      }
    }

    for (const monument of monumentsTable.items) {
      if (scope?.routeSlug && monument.routeSlug !== scope.routeSlug) {
        continue;
      }
      if (scope?.stageSlug && monument.stageSlug !== scope.stageSlug) {
        continue;
      }

      if (includesText(monument.title, normalizedQuery) || includesText(monument.shortStory, normalizedQuery)) {
        results.push({ id: monument.id, type: 'monument', title: monument.title, subtitle: monument.routeSlug, evidence: dataPackEvidence });
      }
    }

    for (const service of servicesTable.items) {
      if (scope?.routeSlug && service.routeSlug !== scope.routeSlug) {
        continue;
      }
      if (scope?.stageSlug && service.stageSlug !== scope.stageSlug) {
        continue;
      }

      if (includesText(service.title, normalizedQuery)) {
        results.push({ id: service.id, type: 'service', title: service.title, subtitle: service.type, evidence: dataPackEvidence });
      }
    }

    return results.slice(0, 50);
  }

  async getCampaignTemplates(): Promise<CampaignTemplate[]> {
    return campaignTemplatesTable.items;
  }

  async getQuestTemplatesForStage(stageSlug: string): Promise<QuestTemplate[]> {
    return questTemplatesTable.items.filter((quest) => !quest.stageSlug || quest.stageSlug === stageSlug).map((quest) => ({
      id: quest.id,
      title: quest.title,
      stageSlug: quest.stageSlug ?? undefined,
    }));
  }

  async getBudgetProfiles() {
    return budgetProfilesTable.items;
  }
}

export const staticCaminoDataRepository = new StaticCaminoDataRepository();
