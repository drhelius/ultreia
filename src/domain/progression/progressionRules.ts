import type { AchievementState, PilgrimProgression, QuestState } from './progressionTypes';

const xpPerLevel = 500;

export const calculateProgression = ({
  completedStages,
  questStates,
  achievementStates,
}: {
  completedStages: number;
  questStates: QuestState[];
  achievementStates: AchievementState[];
}): PilgrimProgression => {
  const completedQuests = questStates.filter((quest) => quest.status === 'completed').length;
  const unlockedAchievementIds = achievementStates.filter((achievement) => achievement.unlockedAtIso).map((achievement) => achievement.achievementId);
  const lifetimeXp = completedStages * 120 + completedQuests * 50 + unlockedAchievementIds.length * 150;
  const level = Math.floor(lifetimeXp / xpPerLevel) + 1;
  const currentXp = lifetimeXp % xpPerLevel;

  return {
    level,
    currentXp,
    xpToNextLevel: xpPerLevel - currentXp,
    lifetimeXp,
    unlockedAchievementIds,
  };
};
