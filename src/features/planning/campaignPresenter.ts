import type { CampaignPlan } from '../../domain';
import type { CampaignRecommendation } from './campaignScorer';

export const recommendationToCampaignPlan = (recommendation: CampaignRecommendation, travelMode: CampaignPlan['travelMode']): CampaignPlan => ({
  id: recommendation.campaign.id,
  title: recommendation.campaign.title,
  routeSlug: recommendation.campaign.routeSlug,
  stageSlugs: recommendation.stages.map((stage) => stage.slug),
  travelMode,
  recommendedDays: recommendation.estimatedDays,
});
