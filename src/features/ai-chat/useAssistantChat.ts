import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ActiveJourney, CampaignPlan, ChatMessage, UserProfile } from '../../domain';
import { useLocalPersistence } from '../../persistence';
import { ChatAgentClient } from '../../services';
import type { DecisionEngineState, LiveTrackingState } from '../live-map';
import { staticCaminoDataRepository } from '../../data/camino';
import { buildAssistantContext } from './buildAssistantContext';

export type AssistantChatState = {
  threadId?: string;
  messages: ChatMessage[];
  sending: boolean;
  clearing?: boolean;
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
  const sending = useRef(false);
  const clearing = useRef(false);
  const conversationVersion = useRef(0);
  const pendingWrite = useRef<Promise<void> | undefined>(undefined);

  const loadThread = useCallback(async () => {
    if (!persistence.repositories) return;
    const version = conversationVersion.current;

    const thread = await persistence.repositories.chatRepository.getOrCreateThread(profile.id, 'Asistente Ultreia');
    const messages = await persistence.repositories.chatRepository.getMessages(thread.id);
    if (version !== conversationVersion.current || clearing.current) return;
    setState((current) => ({ ...current, threadId: thread.id, messages }));
  }, [persistence.repositories, profile.id]);

  useEffect(() => {
    void loadThread();
  }, [loadThread]);

  const sendMessage = useCallback(async (body: string) => {
    if (!persistence.repositories || !state.threadId || !body.trim() || sending.current || clearing.current) return;

    const version = conversationVersion.current;
    sending.current = true;
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
      pendingWrite.current = persistence.repositories.chatRepository.saveMessage(userMessage);
      await pendingWrite.current;
      if (version !== conversationVersion.current) return;
      const [conversation, context] = await Promise.all([
        persistence.repositories.chatRepository.getMessages(state.threadId),
        buildAssistantContext({ profile, journey, campaign, tracking: trackingState, decision: decisionState, dataRepository: staticCaminoDataRepository, repositories: persistence.repositories, timestampIso: nowIso, userMessage: userMessage.body }),
      ]);
      if (version !== conversationVersion.current) return;
      const output = await client.invoke({
        schemaVersion: '1.0',
        locale: 'es-ES',
        userMessage: userMessage.body,
        conversation,
        context,
      }, profile.id);
      if (version !== conversationVersion.current) return;
      const assistantMessage: ChatMessage = {
        id: createId('chat-message-assistant'),
        threadId: state.threadId,
        role: 'assistant',
        body: output.answer,
        createdAtIso: new Date().toISOString(),
      };

      pendingWrite.current = persistence.repositories.chatRepository.saveMessage(assistantMessage);
      await pendingWrite.current;
      if (version !== conversationVersion.current) return;
      const messages = await persistence.repositories.chatRepository.getMessages(state.threadId);
      if (version !== conversationVersion.current) return;
      setState({ threadId: state.threadId, messages, sending: false });
    } catch (error) {
      if (version !== conversationVersion.current) return;
      const messages = await persistence.repositories.chatRepository.getMessages(state.threadId);
      if (version !== conversationVersion.current) return;
      setState({ threadId: state.threadId, messages, sending: false, error: error instanceof Error ? error.message : 'No se pudo invocar ultreia-chat.' });
    } finally {
      if (version === conversationVersion.current) sending.current = false;
    }
  }, [campaign, client, decisionState, journey, persistence.repositories, profile, state.threadId, trackingState]);

  const clear = useCallback(async () => {
    if (!persistence.repositories || !state.threadId || clearing.current) return;
    clearing.current = true;
    conversationVersion.current++;
    sending.current = false;
    setState((current) => ({ ...current, sending: false, clearing: true, error: undefined }));
    try {
      await pendingWrite.current?.catch(() => undefined);
      await persistence.repositories.chatRepository.clearThread(state.threadId);
      setState({ threadId: state.threadId, messages: [], sending: false, clearing: false });
    } catch (error) {
      const messages = await persistence.repositories.chatRepository.getMessages(state.threadId);
      setState({ threadId: state.threadId, messages, sending: false, clearing: false, error: error instanceof Error ? error.message : 'No se pudo limpiar el chat.' });
    } finally {
      clearing.current = false;
    }
  }, [persistence.repositories, state.threadId]);

  return {
    state,
    sendMessage,
    clear,
  };
};
