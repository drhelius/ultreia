import type { CampaignPlan } from '../../domain';
import type { PlanningAgentOutput } from '../../domain/ai/planningAgentTypes';
import type { CampaignRecommendation } from './campaignScorer';
import { mapRepository } from '../../data/camino/mapRepository';

export const planningExplanationGuidance = {
  format: 'single_paragraph' as const,
  maxWords: 120,
  instruction: 'Para cada recomendacion devuelve rationale: un unico parrafo de 3 o 4 frases, idealmente 60-100 palabras y como maximo 120. Explica el tramo elegido (origen, destino y distribucion de etapas), que adaptacion o variante usa frente a la ruta base y por que encaja con dias, modo, intereses, presupuesto y additionalRequirements cuando consten. Indica el compromiso principal o la limitacion si no se puede satisfacer un requisito. Usa routeSelection y stages para describir solo cambios reales del catalogo; si no hay una variante especial no la inventes. startsAtBaseOrigin y endsAtBaseDestination comparan los extremos con la ruta base: si ambos son true no describas el recorrido como recortado, ni que empieza despues o termina antes solo porque su titulo diga adaptada; puede variar la distribucion ciclista o los dias. No afirmes haber acortado, evitado desnivel o garantizado alojamientos sin datos. No expliques puntuaciones internas ni repitas solo las cifras de la ficha. Conserva tambien los campos headline, reasons y tradeoffs del contrato habitual. Si expresas la explicacion mediante reasons en vez de rationale, aplica las mismas reglas y no repitas en cada campo el origen y destino.',
};

export const formatCampaignRationale = (recommendation: CampaignRecommendation, explanation?: PlanningAgentOutput['recommendations'][number]): string => {
  const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();
  const first = recommendation.stages[0];
  const last = recommendation.stages.at(-1);
  const routeSummary = first && last ? `El recorrido va de ${first.startTown} a ${last.endTown}, en ${recommendation.stages.length} etapas.` : '';
  const agentReasons = explanation?.reasons.map(normalize).filter(Boolean) ?? [];
  const parts = [...(agentReasons.length ? [] : [routeSummary]), ...(agentReasons.length ? agentReasons : recommendation.reasons).slice(0, 3), ...(explanation?.tradeoffs.length ? explanation.tradeoffs : recommendation.risks).slice(0, 1)];
  const paragraph = normalize(explanation?.rationale ?? '') || [...new Set(parts.map(normalize).filter(Boolean))].map((part) => /[.!?]$/.test(part) ? part : `${part}.`).join(' ');
  const words = paragraph.split(/\s+/);
  if (words.length <= planningExplanationGuidance.maxWords) return paragraph;
  const clipped = words.slice(0, planningExplanationGuidance.maxWords).join(' ');
  const sentenceEnd = [...clipped.matchAll(/[.!?](?=\s|$)/g)].at(-1)?.index;
  return sentenceEnd !== undefined && sentenceEnd > clipped.length / 2 ? clipped.slice(0, sentenceEnd + 1) : `${clipped}...`;
};

export const selectPlannerRecommendations = (candidates: CampaignRecommendation[], recommendedIds: string[]): CampaignRecommendation[] => {
  if (!recommendedIds.length || new Set(recommendedIds).size !== recommendedIds.length) throw new Error('El planner no devolvio una seleccion valida de rutas. Vuelve a intentarlo.');
  return recommendedIds.map((id) => {
    const candidate = candidates.find((item) => item.campaign.id === id);
    if (!candidate || !mapRepository.getCampaignAudit(candidate.stages.map((stage) => stage.slug)).ready) throw new Error('El planner propuso una ruta sin trazado completo verificado. Vuelve a intentarlo.');
    return candidate;
  });
};

export const recommendationToCampaignPlan = (recommendation: CampaignRecommendation, travelMode: CampaignPlan['travelMode']): CampaignPlan => ({
  id: recommendation.campaign.id,
  title: recommendation.campaign.title,
  routeSlug: recommendation.campaign.routeSlug,
  stageSlugs: recommendation.stages.map((stage) => stage.slug),
  travelMode,
  recommendedDays: recommendation.estimatedDays,
});
