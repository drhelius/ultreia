import type { AchievementState, CollectibleState, QuestState } from '../domain';

export type ProgressionRepository = {
  saveQuestState(state: QuestState): Promise<void>;
  getQuestStates(journeyId: string): Promise<QuestState[]>;
  saveAchievementState(state: AchievementState): Promise<void>;
  getAchievementStates(userId: string): Promise<AchievementState[]>;
  saveCollectibleState(state: CollectibleState): Promise<void>;
  getCollectibleStates(userId: string): Promise<CollectibleState[]>;
};
