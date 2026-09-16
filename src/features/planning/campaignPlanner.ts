import type { BudgetProfile, CaminoStage } from '../../domain';
import type { CaminoDataRepository, CampaignTemplate } from '../../repositories';
import type { OnboardingDraft } from '../onboarding/onboardingTypes';
import { scoreCampaign, type CampaignRecommendation } from './campaignScorer';
import { mapRepository } from '../../data/camino/mapRepository';
import { describeStageAdaptation } from './campaignAdaptation';
import type { PlanningStageAdaptation } from '../../domain/ai/planningAgentTypes';
import { redistributeJourney } from './journeyRedistribution';

type AdaptiveCampaign = CampaignTemplate & { stageAdaptation: PlanningStageAdaptation };

const bySlugOrder = (stageSlugs: string[], stages: CaminoStage[]): CaminoStage[] => {
  const stageBySlug = new Map(stages.map((stage) => [stage.slug, stage]));

  return stageSlugs.map((slug) => stageBySlug.get(slug)).filter((stage): stage is CaminoStage => Boolean(stage));
};

const excludedRouteSlugs = new Set(['epilogo-a-fisterra-y-muxia']);

const endsInSantiago = (value: string): boolean => value.toLowerCase().includes('santiago');

const desiredStageCount = (draft: OnboardingDraft): number => (draft.travelMode === 'car' ? draft.availableDays * 3 : draft.availableDays);

export const connectedStagePaths = (stages: CaminoStage[]): CaminoStage[][] => {
  const verified = stages.filter((stage) => mapRepository.getStageAudit(stage.slug).status === 'verified');
  const nextBySlug = new Map(verified.map((stage) => [stage.slug, verified.filter((next) => next.slug !== stage.slug && mapRepository.getCampaignAudit([stage.slug, next.slug]).ready)]));
  const hasPrevious = new Set([...nextBySlug.values()].flatMap((items) => items.map((stage) => stage.slug)));
  const paths: CaminoStage[][] = [];
  const visit = (path: CaminoStage[]) => {
    const next = (nextBySlug.get(path[path.length - 1].slug) ?? []).filter((stage) => !path.some((item) => item.slug === stage.slug));
    if (!next.length) paths.push(path);
    else for (const stage of next) visit([...path, stage]);
  };
  for (const stage of verified.filter((stage) => !hasPrevious.has(stage.slug))) visit([stage]);
  return paths;
};

const selectAdaptiveStageWindow = (routeStages: CaminoStage[], draft: OnboardingDraft): CaminoStage[] => {
  const targetCount = Math.max(1, desiredStageCount(draft));

  if (draft.goal === 'ruta_completa' || routeStages.length <= targetCount) return routeStages;
  if (draft.goal === 'llegar_a_santiago' || draft.goal === 'compostela_minima' || endsInSantiago(routeStages[routeStages.length - 1]?.endTown ?? '')) {
    return routeStages.slice(Math.max(0, routeStages.length - targetCount));
  }

  return routeStages.slice(0, targetCount);
};

const createAdaptiveCampaigns = async (repository: CaminoDataRepository, draft: OnboardingDraft): Promise<AdaptiveCampaign[]> => {
  const routes = await repository.getRoutes();
  const adaptiveCampaigns: AdaptiveCampaign[] = [];

  for (const route of routes) {
    if (excludedRouteSlugs.has(route.slug)) continue;

    const stages = await repository.getStagesByRoute(route.slug, draft.travelMode === 'bike' ? 'bike' : 'walk');
    for (const path of connectedStagePaths(stages)) {
    if (draft.goal === 'ruta_completa' && (path[0].order !== 1 || path[path.length - 1].order !== Math.max(...stages.filter((stage) => stage.variantGroup === path[0].variantGroup).map((stage) => stage.order)))) continue;
    if (['llegar_a_santiago', 'compostela_minima'].includes(draft.goal) && !endsInSantiago(path[path.length - 1].endTown)) continue;
    const redistributed = redistributeJourney(path, draft);
    if (redistributed) {
      adaptiveCampaigns.push({
        id: `campaign:personalized:${draft.travelMode}:${route.slug}:${path[0].slug}:${draft.availableDays}:${redistributed.adaptation.paceTargetKm}`,
        title: `Ruta personalizada: ${route.title} (${redistributed.stages[0].startTown} a ${redistributed.stages[redistributed.stages.length - 1].endTown})`,
        routeSlug: route.slug,
        stageSlugs: redistributed.stages.map((stage) => stage.slug),
        recommendedDays: redistributed.stages.length,
        stageAdaptation: redistributed.adaptation,
      });
      continue;
    }
    const selectedStages = selectAdaptiveStageWindow(path, draft);
    const firstStage = selectedStages[0];
    const lastStage = selectedStages[selectedStages.length - 1];

    if (!firstStage || !lastStage) continue;

    adaptiveCampaigns.push({
      id: `campaign:adaptive:${draft.travelMode}:${route.slug}:${firstStage.slug}:${lastStage.slug}:${draft.availableDays}`,
      title: `Ruta adaptada: ${route.title} (${firstStage.startTown} a ${lastStage.endTown})`,
      routeSlug: route.slug,
      stageSlugs: selectedStages.map((stage) => stage.slug),
      recommendedDays: selectedStages.length,
      stageAdaptation: describeStageAdaptation(path, selectedStages, draft),
    });
    }
  }

  return adaptiveCampaigns;
};

const resolveStages = async (repository: CaminoDataRepository, campaign: CampaignTemplate, draft: OnboardingDraft): Promise<CaminoStage[]> => {
  if (campaign.stageSlugs.every((slug) => slug.startsWith('planned-v1:'))) {
    const stages = await Promise.all(campaign.stageSlugs.map((slug) => repository.getStage(slug)));
    return stages.filter((stage): stage is CaminoStage => Boolean(stage));
  }
  if (draft.travelMode === 'bike') {
    const bikeStages = await repository.getStagesByRoute(campaign.routeSlug, 'bike');
    const selectedBikeStages = bySlugOrder(campaign.stageSlugs, bikeStages);
    if (selectedBikeStages.length > 0) return selectedBikeStages;
    if (bikeStages.length > 0) return bikeStages;
  }

  const routeStages = await repository.getStagesByRoute(campaign.routeSlug, 'walk');

  return bySlugOrder(campaign.stageSlugs, routeStages);
};

export const planCampaigns = async (repository: CaminoDataRepository, draft: OnboardingDraft, options: { verifiedMapsOnly?: boolean } = {}): Promise<CampaignRecommendation[]> => {
  const [templateCampaigns, adaptiveCampaigns, budgetProfiles] = await Promise.all([repository.getCampaignTemplates(), createAdaptiveCampaigns(repository, draft), repository.getBudgetProfiles()]);
  const campaigns = [...templateCampaigns.filter((campaign) => !excludedRouteSlugs.has(campaign.routeSlug)), ...adaptiveCampaigns];
  const budgetProfile = budgetProfiles.find((profile) => profile.mode === draft.budgetMode) ?? budgetProfiles[0];
  const recommendations: CampaignRecommendation[] = [];
  const seenCampaigns = new Set<string>();

  if (!budgetProfile) {
    return [];
  }

  for (const campaign of campaigns) {
    if (seenCampaigns.has(campaign.id)) continue;
    seenCampaigns.add(campaign.id);

    const route = await repository.getRoute(campaign.routeSlug);
    if (!route || campaign.stageSlugs.length === 0) continue;

    const stages = await resolveStages(repository, campaign, draft);
    if (stages.length === 0) continue;

    const mapAudit = mapRepository.getCampaignAudit(stages.map((stage) => stage.slug));
    if (options.verifiedMapsOnly && !mapAudit.ready) continue;
    const recommendation = scoreCampaign({ campaign, route, stages, draft, budgetProfile });
    recommendation.stageAdaptation = adaptiveCampaigns.find((item) => item.id === campaign.id)?.stageAdaptation
      ?? describeStageAdaptation(stages, stages, draft, 'selected_catalog_stages');
    if (!mapAudit.ready) recommendation.risks.unshift(`Mapa incompleto: ${mapAudit.verifiedCount}/${mapAudit.totalCount} etapas verificadas.${mapAudit.issues.length ? ' Hay discontinuidades entre etapas.' : ''} No disponible para demostracion.`);
    recommendations.push(recommendation);
  }

  const exact = recommendations.filter((item) => item.estimatedDays === draft.availableDays && item.stageAdaptation?.selectionReason === 'redistribute_days_and_pace');
  const eligible = exact.length ? exact : recommendations;
  const seenItineraries = new Set<string>();
  return eligible.sort((left, right) => Number(mapRepository.getCampaignAudit(right.stages.map((stage) => stage.slug)).ready) - Number(mapRepository.getCampaignAudit(left.stages.map((stage) => stage.slug)).ready) || right.score - left.score).filter((item) => {
    const key = item.stages.map((stage) => `${stage.startTown}:${stage.endTown}`).join('|');
    if (seenItineraries.has(key)) return false;
    seenItineraries.add(key);
    return true;
  }).slice(0, 5);
};
