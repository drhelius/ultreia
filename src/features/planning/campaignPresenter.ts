import type { CampaignPlan } from '../../domain';
import type { CampaignRecommendation } from './campaignScorer';
import { mapRepository } from '../../data/camino/mapRepository';

export const selectPlannerRecommendations = (candidates: CampaignRecommendation[], recommendedIds: string[]): CampaignRecommendation[] => {
  if (!recommendedIds.length || new Set(recommendedIds).size !== recommendedIds.length) throw new Error('El planner no devolvio una seleccion valida de rutas. Vuelve a intentarlo.');
  return recommendedIds.map((id) => {
    const candidate = candidates.find((item) => item.campaign.id === id);
    if (!candidate || !mapRepository.getCampaignAudit(candidate.stages.map((stage) => stage.slug)).ready) throw new Error('El planner propuso una ruta sin trazado completo verificado. Vuelve a intentarlo.');
    return candidate;
  });
};

export const recommendationToCampaignPlan = (recommendation: CampaignRecommendation, travelMode: CampaignPlan['travelMode']): CampaignPlan => ({
  id: recommendation.campaign.id,
  title: recommendation.campaign.title,
  routeSlug: recommendation.campaign.routeSlug,
  stageSlugs: recommendation.stages.map((stage) => stage.slug),
  travelMode,
  recommendedDays: recommendation.estimatedDays,
});
