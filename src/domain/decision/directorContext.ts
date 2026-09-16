import type { DecisionContext, DecisionRecommendation } from './decisionTypes';
import type { Coordinates } from '../../core';
import { distanceKmBetween } from '../tracking/trackingCalculations';

export const localRecommendationDate = (timestampIso: string): string => {
  const date = new Date(timestampIso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const recommendationDate = (recommendation: DecisionRecommendation) => recommendation.createdAtIso ?? recommendation.evidence[0]?.generatedAtIso;

export function recommendationsForDay(history: DecisionRecommendation[], journeyId: string, timestampIso: string): DecisionRecommendation[] {
  const today = localRecommendationDate(timestampIso);
  const now = Date.parse(timestampIso);
  return history.filter((recommendation) => {
    const timestamp = recommendationDate(recommendation);
    return recommendation.id.startsWith(`${journeyId}:`) && timestamp && Number.isFinite(Date.parse(timestamp)) && Date.parse(timestamp) <= now && localRecommendationDate(timestamp) === today;
  }).sort((left, right) => Date.parse(recommendationDate(left)!) - Date.parse(recommendationDate(right)!));
}

const stablePlaceId = (id: string, providerUrl?: string): string => {
  if (providerUrl) {
    try {
      const url = new URL(providerUrl);
      if (['www.openstreetmap.org', 'openstreetmap.org'].includes(url.hostname) && /^\/(node|way|relation)\/\d+$/.test(url.pathname)) return `osm:${url.pathname.slice(1).replace('/', ':')}`;
    } catch {}
  }
  return id;
};

export function enrichDirectorContext(context: DecisionContext, history: DecisionRecommendation[], timestampIso: string): DecisionContext {
  const today = recommendationsForDay(history, context.activeJourney.id, timestampIso);
  const recent = today.slice(-20);
  const mentionedIds = new Set(today.flatMap((recommendation) => recommendation.relatedEntityIds ?? []));
  const places: NonNullable<DecisionContext['nearbyPlaces']> = [];
  const origin = context.physical.currentLocation;
  const addPlace = (entity: { id: string; title: string; coordinate?: Coordinates; coordinateStatus: string; geocoding?: { providerUrl?: string } }, details: Pick<NonNullable<DecisionContext['nearbyPlaces']>[number], 'type' | 'address' | 'phone' | 'openingHoursText'>) => {
    if (!origin || entity.coordinateStatus !== 'verified' || !entity.coordinate) return;
    const distanceKm = distanceKmBetween(origin, entity.coordinate);
    if (!Number.isFinite(distanceKm) || distanceKm > 2) return;
    const id = stablePlaceId(entity.id, entity.geocoding?.providerUrl);
    if (places.some((place) => place.id === id)) return;
    places.push({ id, entityId: entity.id, title: entity.title, ...details, distanceKm: Number(distanceKm.toFixed(2)), distanceKind: 'straight_line', availability: 'unknown', mentionedToday: mentionedIds.has(id) || mentionedIds.has(entity.id), evidence: [
      { sourceType: 'data_pack', sourceId: entity.id, generatedAtIso: timestampIso, confidence: 'alta' },
      { sourceType: 'calculation', sourceId: `straight-line:${id}`, generatedAtIso: timestampIso, confidence: 'media', simulated: context.simulation?.enabled },
    ] });
  };
  for (const service of context.stageContext?.services ?? []) addPlace(service, { type: service.type, address: service.address, phone: service.phone, openingHoursText: service.openingHoursText });
  for (const monument of context.stageContext?.monuments ?? []) addPlace(monument, { type: 'monumento' });
  for (const point of context.stageContext?.points ?? []) addPlace(point, { type: point.type === 'fuente' ? 'fuente' : point.type === 'monumento' ? 'monumento' : 'punto' });
  places.sort((left, right) => Number(left.mentionedToday) - Number(right.mentionedToday) || left.distanceKm - right.distanceKm);
  const selected = places.filter((place, index) => places.findIndex((candidate) => candidate.type === place.type) === index).slice(0, 12);
  for (const place of places) {
    if (selected.length >= 12) break;
    if (!selected.includes(place)) selected.push(place);
  }
  const sections = context.stageContext?.sections;
  const stageHighlights: NonNullable<DecisionContext['stageHighlights']> = [];
  if (context.activeStage) {
    const stageSlug = context.activeStage.slug;
    const candidates = [
      { key: 'summary', title: context.activeStage.title, text: context.activeStage.summary },
      ...(sections?.whatToSee ?? []).map((text, index) => ({ key: `culture:${index}`, title: 'Patrimonio de la etapa', text })),
      ...(sections?.observations ?? []).map((text, index) => ({ key: `advice:${index}`, title: 'Detalles del recorrido', text })),
      ...(sections?.difficultyNotes ?? []).map((text, index) => ({ key: `terrain:${index}`, title: 'Terreno de la etapa', text })),
    ];
    for (const candidate of candidates) {
      if (!candidate.text.trim()) continue;
      const id = `stage-fact:${stageSlug}:${candidate.key}`;
      stageHighlights.push({ id, title: candidate.title, text: candidate.text.slice(0, 700), scope: 'stage', mentionedToday: mentionedIds.has(id) || today.some((item) => item.deduplicationKey?.includes(id)), evidence: [{ sourceType: 'data_pack', sourceId: id, generatedAtIso: timestampIso, confidence: 'media' }] });
    }
  }
  const highlights = stageHighlights.sort((left, right) => Number(left.mentionedToday) - Number(right.mentionedToday)).slice(0, 6);
  return {
    ...context,
    timestampIso,
    nearbyPlaces: selected.sort((left, right) => left.distanceKm - right.distanceKm),
    stageHighlights: highlights,
    contentBrief: {
      focus: 'Prioriza informacion nueva de interes: patrimonio, paisaje, localidades y detalles del recorrido, ademas de servicios utiles. Si no hay un riesgo nuevo, no centres la respuesta en repetir precauciones. Un lugar o hecho de esta etapa distinto de los ya tratados es una novedad, aunque pertenezca al mismo tema. Usa solo los hechos adjuntos y resumelos con tus palabras. Los stageHighlights describen la etapa, no necesariamente la posicion actual; no inventes cercania, horarios ni vigencia de incidencias. Puedes referenciar sus IDs en relatedEntityIds y en una clave estable informar:<id>. No fuerces consejos si no hay informacion nueva.',
      newPlaceIds: selected.filter((place) => !place.mentionedToday).map((place) => place.id),
      newHighlightIds: highlights.filter((highlight) => !highlight.mentionedToday).map((highlight) => highlight.id),
    },
    recommendationHistory: {
      localDate: localRecommendationDate(timestampIso),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      totalShownToday: today.length,
      omittedCount: today.length - recent.length,
      deduplicationKeys: [...new Set(today.map((item) => item.deduplicationKey).filter((key): key is string => Boolean(key)))].slice(-128),
      items: recent.map((item) => ({ id: item.id, type: item.type, priority: item.priority, title: item.title, message: item.message.slice(0, 240), createdAtIso: recommendationDate(item), stageSlug: item.stageSlug, deduplicationKey: item.deduplicationKey, relatedEntityIds: item.relatedEntityIds })),
    },
  };
}