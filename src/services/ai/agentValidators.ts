import type { ChatAgentOutput, DirectorAgentOutput, PlanningAgentOutput } from '../../domain';

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));

const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string');

export const isPlanningAgentOutput = (value: unknown): value is PlanningAgentOutput => {
  if (!isRecord(value) || value.schemaVersion !== '1.0' || typeof value.summary !== 'string' || !Array.isArray(value.recommendations) || !isStringArray(value.globalAdvice) || typeof value.requiresUserChoice !== 'boolean') {
    return false;
  }

  return value.recommendations.every((recommendation) => isRecord(recommendation)
    && typeof recommendation.campaignId === 'string'
    && typeof recommendation.fitScore === 'number'
    && isStringArray(recommendation.reasons)
    && isStringArray(recommendation.tradeoffs)
    && typeof recommendation.headline === 'string');
};

export const isDirectorAgentOutput = (value: unknown): value is DirectorAgentOutput => {
  if (!isRecord(value) || value.schemaVersion !== '1.0' || typeof value.generatedAtIso !== 'string' || !Array.isArray(value.recommendations) || !Array.isArray(value.discardedRecommendations)) {
    return false;
  }

  return value.recommendations.every((recommendation) => isRecord(recommendation)
    && typeof recommendation.id === 'string'
    && typeof recommendation.type === 'string'
    && typeof recommendation.priority === 'string'
    && typeof recommendation.title === 'string'
    && typeof recommendation.message === 'string'
    && Array.isArray(recommendation.evidence));
};

export const isChatAgentOutput = (value: unknown): value is ChatAgentOutput => {
  if (!isRecord(value) || value.schemaVersion !== '1.0' || typeof value.answer !== 'string' || !Array.isArray(value.actions) || !isStringArray(value.usedContext)) {
    return false;
  }

  return value.actions.every((action) => isRecord(action) && typeof action.type === 'string' && typeof action.label === 'string');
};
