import type { DecisionRecommendation } from '../decision';

export type QuestBoardItem = {
  id: string;
  title: string;
  kind: 'main' | 'side' | 'safety';
  stageSlug: string;
  description: string;
  linkedEntityId?: string;
  recommendationId?: string;
};

export type QuestBoard = {
  stageSlug: string;
  mainQuest: QuestBoardItem;
  sideQuests: QuestBoardItem[];
  safetyQuests: QuestBoardItem[];
  recommendations: DecisionRecommendation[];
};
