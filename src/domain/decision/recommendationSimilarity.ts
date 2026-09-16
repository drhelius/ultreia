import type { DecisionRecommendation } from './decisionTypes';

const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const protectionTopics = (recommendation: DecisionRecommendation): string[] => {
  if (recommendation.type !== 'seguridad') return [];
  const text = normalize(`${recommendation.title} ${recommendation.message}`);
  const topics: string[] = [];
  if (/\b(viento|cortaviento|cortavientos)\b/.test(text) && /\b(proteg\w*|capa|abriga\w*|cortavientos?|ropa)\b/.test(text)) topics.push('wind-protection');
  if (/\b(sol|solar|uv)\b/.test(text) && /\b(proteg\w*|proteccion|crema|gafas|gorra|sombra)\b/.test(text)) topics.push('sun-protection');
  return topics;
};

export function recommendationsEquivalent(left: DecisionRecommendation, right: DecisionRecommendation): boolean {
  if (left.id === right.id) return true;
  const topics = protectionTopics(left);
  if (topics.some((topic) => protectionTopics(right).includes(topic))) return true;
  const leftEntities = left.relatedEntityIds ?? [];
  const rightEntities = right.relatedEntityIds ?? [];
  if (leftEntities.length && rightEntities.length && !leftEntities.some((id) => rightEntities.includes(id))) return false;
  if (left.deduplicationKey?.trim() && right.deduplicationKey?.trim() && normalize(left.deduplicationKey) === normalize(right.deduplicationKey)) return true;
  if (normalize(left.message) === normalize(right.message)) return true;
  const sameTarget = leftEntities.some((id) => rightEntities.includes(id)) || (!leftEntities.length && !rightEntities.length && (!left.stageSlug || !right.stageSlug || left.stageSlug === right.stageSlug));
  if (sameTarget && normalize(left.title) === normalize(right.title)) return true;
  if (left.type !== right.type) return false;
  const ignored = new Set(['para', 'como', 'esta', 'este', 'estas', 'estos', 'puede', 'puedes', 'unos', 'unas', 'tienes', 'antes', 'sobre', 'ahora', 'camino', 'etapa']);
  const tokens = (recommendation: DecisionRecommendation) => new Set(normalize(`${recommendation.title} ${recommendation.message}`).split(' ').filter((word) => word.length > 3 && !ignored.has(word)));
  const leftWords = tokens(left);
  const rightWords = tokens(right);
  const shared = [...leftWords].filter((word) => rightWords.has(word)).length;
  return shared >= 4 && shared / Math.max(leftWords.size, rightWords.size) >= .7;
}