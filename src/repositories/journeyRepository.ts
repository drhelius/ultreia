import type { ActiveJourney, CampaignPlan, StageProgress } from '../domain';

export type JourneyRepository = {
  getActiveJourney(): Promise<ActiveJourney | undefined>;
  saveActiveJourney(journey: ActiveJourney): Promise<void>;
  saveSelectedCampaign(campaign: CampaignPlan): Promise<void>;
  getSelectedCampaign(campaignId: string): Promise<CampaignPlan | undefined>;
  getStageProgress(journeyId: string): Promise<StageProgress[]>;
  saveStageProgress(progress: StageProgress): Promise<void>;
};
