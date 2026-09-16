import type { CampaignPlan } from '../../domain';
import type { PlanningAgentOutput } from '../../domain/ai/planningAgentTypes';
import type { CampaignRecommendation } from './campaignScorer';
import { mapRepository } from '../../data/camino/mapRepository';

export const planningExplanationGuidance = {
  format: 'single_paragraph' as const,
  maxWords: 120,
  instruction: [
    'rationale: un solo parrafo de 80-120 palabras que explique UNA decision de rediseno y su motivo para esta persona. No describas la ruta en general. Conserva el contrato JSON y campaignId.',
    'Si existe stageAdaptation.redesignDecisions, usa exclusivamente su PRIMER elemento para la comparacion: before.title y before.distanceKm son la jornada anterior; after contiene las jornadas nuevas, cada una con su nombre y kilometros. Debes citar la distancia anterior y las distancias exactas de al menos dos jornadas nuevas, junto a sus paradas. No sustituyas las cifras por una media ni por un rango.',
    'Relaciona el cambio de jornada con la necesidad real del viajero. Lee el contenido de decision.reason y expresalo como motivo concreto en espanol, por ejemplo ritmo tranquilo o dias disponibles, solo si corresponde. El nombre reason es una clave de lectura, nunca texto para el peregrino. stageAdaptation.explanation contiene la misma comparacion como evidencia. No mezcles esta comparacion con el inicio ni con una segunda division de otra etapa.',
    'Comprueba includesOtherStageParts por separado en cada elemento de after. Solo las jornadas con ese valor true incluyen partes de etapas vecinas. Identificalas por sus localidades, no por una posicion supuesta en la lista; las que tienen false no deben recibir esa atribucion. No sumes jornadas completas como si cubrieran exclusivamente la etapa anterior.',
    'Haz explicita la relacion causal: la jornada larga se reparte para responder al ritmo y los dias del usuario. No atribuyas decisiones a fotografia, presupuesto o requisitos libres que no constan como causa. Cierra con una sola frase sobre la dificultad del terreno que se conserva u otro compromiso respaldado. Un inicio distinto no convierte siete jornadas en un plan parcial de siete dias.',
    'Sin redesignDecisions, describe solo los cambios acreditados por changes o startChange/endChange. Si stageBoundariesChanged=false, explica el encaje o seleccion sin inventar rediseno. Antes de responder comprueba que rationale no contiene reason, before, after, newStops, includesOtherStageParts ni otros nombres internos. No hables de fichas, pantallas, catalogos, etapas calculadas, algoritmos o de inventar/no inventar. No prometas seguridad ni alojamiento.',
  ].join(' '),
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
