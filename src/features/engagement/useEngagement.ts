import { useCallback, useEffect, useState } from 'react';

import { systemClock } from '../../core';
import { staticCaminoDataRepository } from '../../data/camino';
import type { ActiveJourney, BudgetProfile, BudgetSummary, CampaignPlan, JournalEntry, PilgrimProgression, QuestBoard, QuestState, StageProgress, UserProfile } from '../../domain';
import { buildQuestBoard, calculateBudgetSummary, calculateProgression, createJournalDraft } from '../../domain';
import { useLocalPersistence } from '../../persistence';
import type { LiveTrackingState } from '../live-map';

export type EngagementState = {
  questBoard?: QuestBoard;
  progression?: PilgrimProgression;
  budget?: BudgetSummary;
  journalDraft?: JournalEntry;
  loading: boolean;
  error?: string;
};

const createId = (scope: string) => `${scope}:${Date.now()}`;

export const useEngagement = ({
  profile,
  journey,
  campaign,
  trackingState,
}: {
  profile: UserProfile;
  journey: ActiveJourney;
  campaign: CampaignPlan;
  trackingState: LiveTrackingState;
}) => {
  const persistence = useLocalPersistence();
  const [state, setState] = useState<EngagementState>({ loading: true });

  const refresh = useCallback(async () => {
    if (!persistence.repositories || !journey.activeStageSlug || !trackingState.activeStage) {
      setState({ loading: false });
      return;
    }

    try {
      const [stagePoints, monuments, services, lastDecisionCycle, questStates, achievementStates, expenses, budgetProfiles] = await Promise.all([
        staticCaminoDataRepository.getStagePoints(journey.activeStageSlug),
        staticCaminoDataRepository.getMonumentsByStage(journey.activeStageSlug),
        staticCaminoDataRepository.getServicesByStage(journey.activeStageSlug),
        persistence.repositories.decisionStateRepository.getLastCycle(),
        persistence.repositories.progressionRepository.getQuestStates(journey.id),
        persistence.repositories.progressionRepository.getAchievementStates(profile.id),
        persistence.repositories.expenseRepository.getExpensesByJourney(journey.id),
        staticCaminoDataRepository.getBudgetProfiles(),
      ]);
      const completedStages = (await persistence.repositories.journeyRepository.getStageProgress(journey.id)).filter((progress: StageProgress) => progress.state === 'completada').length;
      const questBoard = buildQuestBoard({
        stage: trackingState.activeStage,
        stagePoints,
        monuments,
        services,
        recommendations: lastDecisionCycle?.recommendations ?? [],
      });
      const progression = calculateProgression({ completedStages, questStates, achievementStates });
      const budgetProfile = budgetProfiles.find((profileItem: BudgetProfile) => profileItem.mode === profile.budgetMode) ?? budgetProfiles[0];
      const budget = budgetProfile ? calculateBudgetSummary({ budgetProfile, estimatedDays: campaign.recommendedDays, expenses }) : undefined;
      const existingEntries = await persistence.repositories.journalRepository.getEntriesByJourney(journey.id);
      const journalDraft = existingEntries.find((entry: JournalEntry) => entry.stageSlug === journey.activeStageSlug && entry.status === 'draft');

      setState({ questBoard, progression, budget, journalDraft, loading: false });
    } catch (error) {
      setState({ loading: false, error: error instanceof Error ? error.message : 'Error cargando engagement' });
    }
  }, [campaign.recommendedDays, journey.activeStageSlug, journey.id, persistence.repositories, profile.budgetMode, profile.id, trackingState.activeStage]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const activateQuest = useCallback(async (questTemplateId: string) => {
    if (!persistence.repositories) return;
    const nowIso = systemClock.nowIso();
    const questState: QuestState = {
      id: `quest-state:${journey.id}:${questTemplateId}`,
      journeyId: journey.id,
      questTemplateId,
      status: 'active',
      progress: 0,
      updatedAtIso: nowIso,
    };
    await persistence.repositories.progressionRepository.saveQuestState(questState);
    await refresh();
  }, [journey.id, persistence.repositories, refresh]);

  const completeActiveStage = useCallback(async () => {
    if (!persistence.repositories || !journey.activeStageSlug || !trackingState.activeStage) return;
    const nowIso = systemClock.nowIso();
    await persistence.repositories.journeyRepository.saveStageProgress({
      journeyId: journey.id,
      stageSlug: journey.activeStageSlug,
      state: 'completada',
      completedAtIso: nowIso,
      evidence: { sourceType: 'user_input', sourceId: 'complete-stage', generatedAtIso: nowIso, confidence: 'alta' },
    });
    await persistence.repositories.progressionRepository.saveAchievementState({
      id: `achievement-state:${profile.id}:achievement:primera-etapa`,
      userId: profile.id,
      achievementId: 'achievement:primera-etapa',
      unlockedAtIso: nowIso,
      progress: 1,
    });
    const samples = trackingState.session ? await persistence.repositories.trackingRepository.getSamples(trackingState.session.id) : [];
    const questStates = await persistence.repositories.progressionRepository.getQuestStates(journey.id);
    const journalDraft = createJournalDraft({
      id: createId('journal'),
      journeyId: journey.id,
      stage: trackingState.activeStage,
      samples,
      completedQuestStates: questStates.filter((quest: QuestState) => quest.status === 'completed'),
      nowIso,
    });
    await persistence.repositories.journalRepository.saveEntry(journalDraft);
    await refresh();
  }, [journey.activeStageSlug, journey.id, persistence.repositories, profile.id, refresh, trackingState.activeStage, trackingState.session]);

  const saveExpense = useCallback(async (amountEur: number, note: string) => {
    if (!persistence.repositories) return;
    const nowIso = systemClock.nowIso();
    await persistence.repositories.expenseRepository.saveExpense({
      id: createId('expense'),
      journeyId: journey.id,
      stageSlug: journey.activeStageSlug,
      category: 'extras',
      amountEur,
      spentAtIso: nowIso,
      note,
    });
    await refresh();
  }, [journey.activeStageSlug, journey.id, persistence.repositories, refresh]);

  return {
    state,
    refresh,
    activateQuest,
    completeActiveStage,
    saveExpense,
  };
};
