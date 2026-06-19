import type { DateIso } from '../../core';

export type ChatMessageRole = 'user' | 'assistant' | 'system';

export type ChatThread = {
  id: string;
  userId: string;
  title: string;
  createdAtIso: DateIso;
  updatedAtIso: DateIso;
};

export type ChatMessage = {
  id: string;
  threadId: string;
  role: ChatMessageRole;
  body: string;
  createdAtIso: DateIso;
};

export type ChatAssistantAction = {
  type: 'open_stage' | 'open_discover' | 'open_safety' | 'start_tracking' | 'none';
  label: string;
  payload?: Record<string, string | number | boolean>;
};
