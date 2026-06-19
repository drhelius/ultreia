import { useCallback, useEffect, useMemo, useState } from 'react';

import type { ActiveJourney, CampaignPlan, ChatMessage, UserProfile } from '../../domain';
import { useLocalPersistence } from '../../persistence';
import { ChatAgentClient } from '../../services';
import type { DecisionEngineState, LiveTrackingState } from '../live-map';

export type AssistantChatState = {
  threadId?: string;
  messages: ChatMessage[];
  sending: boolean;
  error?: string;
};

const createId = (scope: string) => `${scope}:${Date.now()}`;

export const useAssistantChat = ({
  profile,
  journey,
  campaign,
  trackingState,
  decisionState,
}: {
  profile: UserProfile;
  journey: ActiveJourney;
  campaign: CampaignPlan;
  trackingState: LiveTrackingState;
  decisionState: DecisionEngineState;
}) => {
  const persistence = useLocalPersistence();
  const client = useMemo(() => new ChatAgentClient(), []);
  const [state, setState] = useState<AssistantChatState>({ messages: [], sending: false });

  const loadThread = useCallback(async () => {
    if (!persistence.repositories) return;

    const thread = await persistence.repositories.chatRepository.getOrCreateThread(profile.id, 'Asistente Ultreia');
    const messages = await persistence.repositories.chatRepository.getMessages(thread.id);
    setState((current) => ({ ...current, threadId: thread.id, messages }));
  }, [persistence.repositories, profile.id]);

  useEffect(() => {
    void loadThread();
  }, [loadThread]);

  const sendMessage = useCallback(async (body: string) => {
    if (!persistence.repositories || !state.threadId || !body.trim()) return;

    setState((current) => ({ ...current, sending: true, error: undefined }));
    const nowIso = new Date().toISOString();
    const userMessage: ChatMessage = {
      id: createId('chat-message-user'),
      threadId: state.threadId,
      role: 'user',
      body: body.trim(),
      createdAtIso: nowIso,
    };

    try {
      await persistence.repositories.chatRepository.saveMessage(userMessage);
      const conversation = [...state.messages, userMessage];
      const output = await client.invoke({
        schemaVersion: '1.0',
        locale: 'es-ES',
        userMessage: userMessage.body,
        conversation,
        context: {
          user: {
            displayName: profile.displayName,
            pilgrimClasses: profile.pilgrimClasses,
            travelMode: profile.travelMode,
            budgetMode: profile.budgetMode,
          },
          journey: {
            routeSlug: campaign.routeSlug,
            campaignTitle: campaign.title,
            activeStageSlug: journey.activeStageSlug,
          },
          activeStage: trackingState.activeStage ? {
            title: trackingState.activeStage.title,
            startTown: trackingState.activeStage.startTown,
            endTown: trackingState.activeStage.endTown,
            distanceKm: trackingState.activeStage.distanceKm,
            difficulty: trackingState.activeStage.difficulty,
            summary: trackingState.activeStage.summary,
          } : undefined,
          tracking: {
            progressPercent: trackingState.progressPercent,
            remainingKm: trackingState.remainingKm,
            completedDistanceKm: trackingState.completedDistanceKm,
            etaMinutes: trackingState.etaMinutes,
          },
          nearby: trackingState.nearby.map((entity) => ({ id: entity.id, title: entity.title, type: entity.type, distanceKm: entity.distanceKm })),
          recommendations: decisionState.recommendations.map((recommendation) => ({ title: recommendation.title, priority: recommendation.priority, message: recommendation.message })),
        },
      }, profile.id);
      const assistantMessage: ChatMessage = {
        id: createId('chat-message-assistant'),
        threadId: state.threadId,
        role: 'assistant',
        body: output.answer,
        createdAtIso: new Date().toISOString(),
      };

      await persistence.repositories.chatRepository.saveMessage(assistantMessage);
      const messages = await persistence.repositories.chatRepository.getMessages(state.threadId);
      setState({ threadId: state.threadId, messages, sending: false });
    } catch (error) {
      const messages = await persistence.repositories.chatRepository.getMessages(state.threadId);
      setState({ threadId: state.threadId, messages, sending: false, error: error instanceof Error ? error.message : 'No se pudo invocar ultreia-chat.' });
    }
  }, [campaign.routeSlug, campaign.title, client, decisionState.recommendations, journey.activeStageSlug, persistence.repositories, profile.budgetMode, profile.displayName, profile.id, profile.pilgrimClasses, profile.travelMode, state.messages, state.threadId, trackingState.activeStage, trackingState.completedDistanceKm, trackingState.etaMinutes, trackingState.nearby, trackingState.progressPercent, trackingState.remainingKm]);

  const clear = useCallback(async () => {
    if (!persistence.repositories || !state.threadId) return;
    await persistence.repositories.chatRepository.clearThread(state.threadId);
    await loadThread();
  }, [loadThread, persistence.repositories, state.threadId]);

  return {
    state,
    sendMessage,
    clear,
  };
};
