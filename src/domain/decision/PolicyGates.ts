import type { DecisionOutput, DecisionRecommendation } from './decisionTypes';
import { recommendationsEquivalent } from './recommendationSimilarity';

export const isLocationSetupRecommendation = (recommendation: DecisionRecommendation): boolean =>
  recommendation.id.endsWith('decision:tracking:registrar-ubicacion')
  || recommendation.id.endsWith('decision:tracking:mas-muestras')
  || recommendation.deduplicationKey === 'registrar:gps'
  || recommendation.evidence.some((evidence) => evidence.sourceId === 'missing-location' || evidence.sourceId === 'eta-needs-samples');

const byPriority = (left: DecisionRecommendation, right: DecisionRecommendation) => {
  const rank = { critica: 4, alta: 3, media: 2, baja: 1 };
  return rank[right.priority] - rank[left.priority];
};

export const applyPolicyGates = ({
  output,
  recentRecommendations,
}: {
  output: DecisionOutput;
  recentRecommendations: DecisionRecommendation[];
}): DecisionOutput => {
  const accepted: DecisionRecommendation[] = [];
  const discarded: DecisionRecommendation[] = [...output.discardedRecommendations];

  for (const candidate of [...output.recommendations].sort(byPriority)) {
    const recommendation = candidate.priority === 'critica' && candidate.evidence.some((evidence) => evidence.confidence === 'baja') ? { ...candidate, priority: 'alta' as const } : candidate;
    if (recommendation.evidence.length === 0 || isLocationSetupRecommendation(recommendation)) {
      discarded.push(recommendation);
      continue;
    }

    if (accepted.some((previous) => recommendationsEquivalent(previous, recommendation)) || (recommendation.priority !== 'critica' && recentRecommendations.some((previous) => recommendationsEquivalent(previous, recommendation)))) {
      discarded.push(recommendation);
      continue;
    }

    if (accepted.length >= 4) {
      discarded.push(recommendation);
      continue;
    }

    accepted.push(recommendation);
  }

  return {
    ...output,
    recommendations: accepted.sort(byPriority).slice(0, 4),
    discardedRecommendations: discarded,
  };
};
