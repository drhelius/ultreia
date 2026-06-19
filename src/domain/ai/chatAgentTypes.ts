import type { ChatAssistantAction, ChatMessage } from '../chat';
import type { BudgetMode, PilgrimClass } from '../user';

export type ChatAgentContext = {
  user: {
    displayName: string;
    pilgrimClasses: PilgrimClass[];
    travelMode: string;
    budgetMode: BudgetMode;
  };
  journey: {
    routeSlug?: string;
    campaignTitle?: string;
    activeStageSlug?: string;
  };
  activeStage?: {
    title: string;
    startTown: string;
    endTown: string;
    distanceKm: number;
    difficulty: string;
    summary: string;
  };
  tracking: {
    progressPercent?: number;
    remainingKm?: number;
    completedDistanceKm?: number;
    etaMinutes?: number;
  };
  nearby: Array<{
    id: string;
    title: string;
    type: string;
    distanceKm: number;
  }>;
  recommendations: Array<{
    title: string;
    priority: string;
    message: string;
  }>;
};

export type ChatAgentInput = {
  schemaVersion: '1.0';
  locale: 'es-ES';
  userMessage: string;
  conversation: ChatMessage[];
  context: ChatAgentContext;
};

export type ChatAgentOutput = {
  schemaVersion: '1.0';
  answer: string;
  actions: ChatAssistantAction[];
  usedContext: string[];
};
