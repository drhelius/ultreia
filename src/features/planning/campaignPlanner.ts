import type { BudgetProfile, CaminoStage } from '../../domain';
import type { CaminoDataRepository, CampaignTemplate } from '../../repositories';
import type { OnboardingDraft } from '../onboarding/onboardingTypes';
import { scoreCampaign, type CampaignRecommendation } from './campaignScorer';

const bySlugOrder = (stageSlugs: string[], stages: CaminoStage[]): CaminoStage[] => {
  const stageBySlug = new Map(stages.map((stage) => [stage.slug, stage]));

  return stageSlugs.map((slug) => stageBySlug.get(slug)).filter((stage): stage is CaminoStage => Boolean(stage));
};

const excludedRouteSlugs = new Set(['epilogo-a-fisterra-y-muxia']);

const endsInSantiago = (value: string): boolean => value.toLowerCase().includes('santiago');

const desiredStageCount = (draft: OnboardingDraft): number => (draft.travelMode === 'car' ? draft.availableDays * 3 : draft.availableDays);

const selectAdaptiveStageWindow = (routeStages: CaminoStage[], draft: OnboardingDraft): CaminoStage[] => {
  const targetCount = Math.max(1, desiredStageCount(draft));

  if (draft.goal === 'ruta_completa' || routeStages.length <= targetCount) return routeStages;
  if (draft.goal === 'llegar_a_santiago' || draft.goal === 'compostela_minima' || endsInSantiago(routeStages[routeStages.length - 1]?.endTown ?? '')) {
    return routeStages.slice(Math.max(0, routeStages.length - targetCount));
  }

  return routeStages.slice(0, targetCount);
};

const createAdaptiveCampaigns = async (repository: CaminoDataRepository, draft: OnboardingDraft): Promise<CampaignTemplate[]> => {
  const routes = await repository.getRoutes();
  const adaptiveCampaigns: CampaignTemplate[] = [];

  for (const route of routes) {
    if (excludedRouteSlugs.has(route.slug)) continue;

    const stages = await repository.getStagesByRoute(route.slug, draft.travelMode === 'bike' ? 'bike' : 'walk');
    const selectedStages = selectAdaptiveStageWindow(stages, draft);
    const firstStage = selectedStages[0];
    const lastStage = selectedStages[selectedStages.length - 1];

    if (!firstStage || !lastStage) continue;

    adaptiveCampaigns.push({
      id: `campaign:adaptive:${draft.travelMode}:${route.slug}:${firstStage.order}-${lastStage.order}:${draft.availableDays}`,
      title: `Ruta adaptada: ${route.title} (${firstStage.startTown} a ${lastStage.endTown})`,
      routeSlug: route.slug,
      stageSlugs: selectedStages.map((stage) => stage.slug),
      recommendedDays: selectedStages.length,
    });
  }

  return adaptiveCampaigns;
};

const resolveStages = async (repository: CaminoDataRepository, campaign: CampaignTemplate, draft: OnboardingDraft): Promise<CaminoStage[]> => {
  if (draft.travelMode === 'bike') {
    const bikeStages = await repository.getStagesByRoute(campaign.routeSlug, 'bike');
    const selectedBikeStages = bySlugOrder(campaign.stageSlugs, bikeStages);
    if (selectedBikeStages.length > 0) return selectedBikeStages;
    if (bikeStages.length > 0) return bikeStages;
  }

  const routeStages = await repository.getStagesByRoute(campaign.routeSlug, 'walk');

  return bySlugOrder(campaign.stageSlugs, routeStages);
};

export const planCampaigns = async (repository: CaminoDataRepository, draft: OnboardingDraft): Promise<CampaignRecommendation[]> => {
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

    recommendations.push(scoreCampaign({ campaign, route, stages, draft, budgetProfile }));
  }

  return recommendations.sort((left, right) => right.score - left.score).slice(0, 5);
};
