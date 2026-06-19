import type { DateIso } from '../../core';

export type QuestStateStatus = 'available' | 'active' | 'completed' | 'dismissed';

export type QuestState = {
  id: string;
  journeyId: string;
  questTemplateId: string;
  status: QuestStateStatus;
  progress: number;
  updatedAtIso: DateIso;
};

export type AchievementState = {
  id: string;
  userId: string;
  achievementId: string;
  unlockedAtIso?: DateIso;
  progress: number;
};

export type CollectibleState = {
  id: string;
  userId: string;
  collectibleId: string;
  count: number;
  updatedAtIso: DateIso;
};

export type PilgrimProgression = {
  level: number;
  currentXp: number;
  xpToNextLevel: number;
  lifetimeXp: number;
  unlockedAchievementIds: string[];
};

