import type { DecisionCycle, DecisionRecommendation } from '../domain';

export type DecisionStateRepository = {
  getLastCycle(): Promise<DecisionCycle | undefined>;
  saveCycle(cycle: DecisionCycle): Promise<void>;
  getNotificationHistory(): Promise<DecisionRecommendation[]>;
  markRecommendationShown(recommendation: DecisionRecommendation): Promise<void>;
  clearDecisionState(): Promise<void>;
};
