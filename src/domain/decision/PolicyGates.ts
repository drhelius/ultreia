import type { DecisionOutput, DecisionRecommendation } from './decisionTypes';

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
  const recentTitles = new Set(recentRecommendations.map((recommendation) => recommendation.title));
  const accepted: DecisionRecommendation[] = [];
  const discarded: DecisionRecommendation[] = [...output.discardedRecommendations];

  for (const recommendation of output.recommendations) {
    if (recommendation.evidence.length === 0) {
      discarded.push(recommendation);
      continue;
    }

    if (recentTitles.has(recommendation.title) && recommendation.priority !== 'critica') {
      discarded.push(recommendation);
      continue;
    }

    if (recommendation.evidence.some((evidence) => evidence.confidence === 'baja') && recommendation.priority === 'critica') {
      accepted.push({ ...recommendation, priority: 'alta' });
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
