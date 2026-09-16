import { useCallback, useEffect, useRef, useState } from 'react';

import { systemClock } from '../../core';
import { staticCaminoDataRepository } from '../../data/camino';
import type { ActiveJourney, BudgetProfile, BudgetSummary, CampaignPlan, JournalEntry, PilgrimProgression, QuestBoard, QuestState, StageProgress, UserProfile } from '../../domain';
import { buildQuestBoard, calculateBudgetSummary, calculateProgression, createJournalDraft } from '../../domain';
import { useLocalPersistence } from '../../persistence';
import type { LiveTrackingState } from '../live-map';
import type { ExpenseCategory, ExpenseEntry } from '../../domain';
import { completeJourneyStage } from './completeJourneyStage';

export type EngagementState = {
  questBoard?: QuestBoard;
  progression?: PilgrimProgression;
  budget?: BudgetSummary;
  journalDraft?: JournalEntry;
  entries?: JournalEntry[];
  expenses?: ExpenseEntry[];
  stageProgress?: StageProgress[];
  questStates?: QuestState[];
  loading: boolean;
  error?: string;
};

const createId = (scope: string) => `${scope}:${Date.now()}`;

export const useEngagement = ({
  profile,
  journey,
  campaign,
  trackingState,
  onJourneyChanged,
}: {
  profile: UserProfile;
  journey: ActiveJourney;
  campaign: CampaignPlan;
  trackingState: LiveTrackingState;
  onJourneyChanged?: (journey: ActiveJourney) => void;
}) => {
  const persistence = useLocalPersistence();
  const [state, setState] = useState<EngagementState>({ loading: true });
  const completing = useRef(false);

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
      const stageProgress = await persistence.repositories.journeyRepository.getStageProgress(journey.id);
      const completedStages = stageProgress.filter((progress: StageProgress) => progress.state === 'completada').length;
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

      setState({ questBoard, progression, budget, journalDraft, entries: existingEntries, expenses, stageProgress, questStates, loading: false });
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
    if (!persistence.repositories || !trackingState.activeStage || completing.current) return;
    completing.current = true;
    try {
      const nextJourney = await completeJourneyStage({ repositories: persistence.repositories, journey, campaign, profile, stage: trackingState.activeStage, samples: trackingState.samples, distanceKm: trackingState.completedDistanceKm, nowIso: systemClock.nowIso() });
      onJourneyChanged?.(nextJourney);
      await refresh();
    } catch (error) {
      setState((current) => ({ ...current, error: error instanceof Error ? error.message : 'No se pudo cerrar la etapa.' }));
    } finally { completing.current = false; }
  }, [campaign, journey, onJourneyChanged, persistence.repositories, profile, refresh, trackingState]);

  const saveExpense = useCallback(async (amountEur: number, note: string, category: ExpenseCategory = 'extras') => {
    if (!persistence.repositories) return;
    if (!Number.isFinite(amountEur) || amountEur <= 0) throw new Error('Introduce un importe mayor que cero.');
    const nowIso = systemClock.nowIso();
    await persistence.repositories.expenseRepository.saveExpense({
      id: createId('expense'),
      journeyId: journey.id,
      stageSlug: journey.activeStageSlug,
      category,
      amountEur,
      spentAtIso: nowIso,
      note,
    });
    await refresh();
  }, [journey.activeStageSlug, journey.id, persistence.repositories, refresh]);

  const saveJournal = async (entry: JournalEntry) => {
    await persistence.repositories?.journalRepository.saveEntry({ ...entry, status: 'saved', updatedAtIso: systemClock.nowIso() });
    await refresh();
  };

  const completeQuest = async (questId: string) => {
    await persistence.repositories?.progressionRepository.saveQuestState({ id: `quest-state:${journey.id}:${questId}`, journeyId: journey.id, questTemplateId: questId, status: 'completed', progress: 1, updatedAtIso: systemClock.nowIso() });
    await refresh();
  };

  const deleteExpense = async (expenseId: string) => {
    await persistence.repositories?.expenseRepository.deleteExpense(expenseId);
    await refresh();
  };

  return {
    state,
    refresh,
    activateQuest,
    completeActiveStage,
    saveExpense,
    saveJournal,
    completeQuest,
    deleteExpense,
  };
};
