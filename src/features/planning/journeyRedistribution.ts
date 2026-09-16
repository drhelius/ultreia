import { lineString, nearestPointOnLine, point } from '@turf/turf';
import type { CaminoStage } from '../../domain';
import type { PlanningStageAdaptation } from '../../domain/ai/planningAgentTypes';
import { mapRepository } from '../../data/camino/mapRepository';
import { plannedStageSlug, type PlannedStageDefinition } from '../../data/camino/plannedStages';
import type { OnboardingDraft } from '../onboarding/onboardingTypes';

type Stop = { town: string; km: number };
const stopCache = new Map<string, Stop[]>();

const stageStops = (stage: CaminoStage): Stop[] => {
  const cached = stopCache.get(stage.slug);
  if (cached) return cached;
  const geometry = mapRepository.getStageGeometry(stage.slug)!;
  const line = lineString(geometry.coordinates);
  const west = Math.min(...geometry.coordinates.map((coordinate) => coordinate[0]));
  const east = Math.max(...geometry.coordinates.map((coordinate) => coordinate[0]));
  const south = Math.min(...geometry.coordinates.map((coordinate) => coordinate[1]));
  const north = Math.max(...geometry.coordinates.map((coordinate) => coordinate[1]));
  const stops: Stop[] = [{ town: stage.startTown, km: 0 }, { town: stage.endTown, km: geometry.distanceKm }];
  for (const town of mapRepository.getPlanningTowns(stage.routeSlug)) {
    const coordinate = town.coordinate!;
    if (coordinate.longitude < west - .005 || coordinate.longitude > east + .005 || coordinate.latitude < south - .005 || coordinate.latitude > north + .005) continue;
    const projected = nearestPointOnLine(line, point([coordinate.longitude, coordinate.latitude]));
    if (projected.properties.dist > .35 || projected.properties.location < 1 || projected.properties.location > geometry.distanceKm - 1) continue;
    stops.push({ town: town.title, km: projected.properties.location });
  }
  stops.sort((left, right) => left.km - right.km);
  const distinct = stops.filter((stop, index) => !index || stop.km - stops[index - 1].km > .5);
  stopCache.set(stage.slug, distinct);
  return distinct;
};

export const redistributionPace = (draft: OnboardingDraft) => {
  const relaxed = draft.pilgrimClasses.includes('tranquilo') || draft.goal === 'baja_dificultad';
  const sporting = !relaxed && draft.pilgrimClasses.includes('deportista');
  return {
    targetKm: draft.travelMode === 'bike' ? relaxed ? 40 : sporting ? 70 : 55 : relaxed ? 18 : sporting ? 28 : 23,
    reason: relaxed ? 'Perfil tranquilo o preferencia por menor esfuerzo: jornadas mas cortas.' : sporting ? 'Perfil deportivo: admite mas distancia diaria, sin reducir la dificultad del terreno.' : 'Ritmo moderado: repartir distancia y esfuerzo entre los dias disponibles.',
  };
};

export const redistributeJourney = (source: CaminoStage[], draft: OnboardingDraft): { stages: CaminoStage[]; adaptation: PlanningStageAdaptation } | undefined => {
  if (!source.length || draft.travelMode === 'car' || !Number.isInteger(draft.availableDays) || draft.availableDays < 1 || draft.availableDays > 60) return undefined;
  if (!mapRepository.getCampaignAudit(source.map((stage) => stage.slug)).ready) return undefined;
  const pace = redistributionPace(draft);
  let totalKm = 0;
  const offsets = source.map((stage) => {
    const fromKm = totalKm;
    totalKm += mapRepository.getStageGeometry(stage.slug)!.distanceKm;
    return { stage, fromKm, toKm: totalKm };
  });
  const allStops = offsets.flatMap(({ stage, fromKm }) => stageStops(stage).map((stop) => ({ town: stop.town, km: stop.km + fromKm }))).sort((left, right) => left.km - right.km);
  const stops = allStops.filter((stop, index) => !index || stop.km - allStops[index - 1].km > .5);
  const finalStop = { town: source[source.length - 1].endTown, km: totalKm };
  if (totalKm - stops[stops.length - 1].km > .001) stops.push(finalStop);
  else stops[stops.length - 1] = finalStop;
  const days = draft.availableDays;
  const keepsArrival = ['llegar_a_santiago', 'compostela_minima'].includes(draft.goal) || source[source.length - 1].endTown.toLowerCase().includes('santiago');
  const preferredKm = Math.min(totalKm, days * pace.targetKm);
  const wantedStart = draft.goal === 'ruta_completa' || !keepsArrival ? 0 : totalKm - preferredKm;
  const wantedEnd = draft.goal === 'ruta_completa' || keepsArrival ? totalKm : preferredKm;
  const nearest = (km: number) => stops.reduce((best, stop, index) => Math.abs(stop.km - km) < Math.abs(stops[best].km - km) ? index : best, 0);
  const startIndex = nearest(wantedStart);
  const endIndex = nearest(wantedEnd);
  const selectedStops = stops.slice(startIndex, endIndex + 1);
  if (selectedStops.length < days + 1) return undefined;
  const spanKm = selectedStops[selectedStops.length - 1].km - selectedStops[0].km;
  if (spanKm / days < (draft.travelMode === 'bike' ? 10 : 5)) return undefined;
  if (draft.goal === 'compostela_minima' && spanKm < (draft.travelMode === 'bike' ? 200 : 100)) return undefined;
  const effortAt = (km: number) => offsets.reduce((sum, item) => sum + Math.max(0, Math.min(km, item.toKm) - item.fromKm) * (item.stage.difficulty === 'alta' ? 1.25 : item.stage.difficulty === 'media' ? 1.1 : 1), 0);
  const efforts = selectedStops.map((stop) => effortAt(stop.km));
  const targetEffort = (efforts[efforts.length - 1] - efforts[0]) / days;
  const costs = Array.from({ length: days + 1 }, () => Array(selectedStops.length).fill(Infinity) as number[]);
  const previous = Array.from({ length: days + 1 }, () => Array(selectedStops.length).fill(-1) as number[]);
  costs[0][0] = 0;
  for (let day = 1; day <= days; day++) {
    for (let end = day; end < selectedStops.length; end++) {
      for (let start = day - 1; start < end; start++) {
        const km = selectedStops[end].km - selectedStops[start].km;
        if (!Number.isFinite(costs[day - 1][start]) || km < (draft.travelMode === 'bike' ? 8 : 4) || km > pace.targetKm * 1.5) continue;
        const cost = costs[day - 1][start] + (efforts[end] - efforts[start] - targetEffort) ** 2;
        if (cost < costs[day][end]) { costs[day][end] = cost; previous[day][end] = start; }
      }
    }
  }
  let cursor = selectedStops.length - 1;
  if (!Number.isFinite(costs[days][cursor])) return undefined;
  const boundaries = [selectedStops[cursor]];
  for (let day = days; day > 0; day--) { cursor = previous[day][cursor]; boundaries.unshift(selectedStops[cursor]); }
  const definitions: PlannedStageDefinition[] = boundaries.slice(1).map((end, index) => ({
    day: index + 1, startTown: boundaries[index].town, endTown: end.town,
    parts: offsets.flatMap((item) => {
      const fromKm = Math.max(boundaries[index].km, item.fromKm) - item.fromKm;
      const toKm = Math.min(end.km, item.toKm) - item.fromKm;
      return toKm - fromKm > .000001 ? [{ stageSlug: item.stage.slug, fromKm, toKm }] : [];
    }),
  }));
  const stages = definitions.map((definition) => mapRepository.getStageDefinition(plannedStageSlug(definition)));
  if (stages.some((stage) => !stage)) return undefined;
  const resolved = stages as CaminoStage[];
  if (!mapRepository.getCampaignAudit(resolved.map((stage) => stage.slug)).ready) return undefined;
  const describe = (stage: CaminoStage) => ({ slug: stage.slug, title: stage.title, order: stage.order });
  const dailyStages = definitions.map((definition, index) => ({ day: definition.day, title: resolved[index].title, distanceKm: resolved[index].distanceKm, sourceParts: definition.parts.map((part) => ({ title: source.find((stage) => stage.slug === part.stageSlug)!.title, fromKm: Number(part.fromKm.toFixed(1)), toKm: Number(part.toKm.toFixed(1)), fullStage: part.fromKm < .001 && Math.abs(part.toKm - mapRepository.getStageGeometry(part.stageSlug)!.distanceKm) < .001 })) }));
  const changes = offsets.flatMap((item): NonNullable<PlanningStageAdaptation['changes']> => {
    const included = definitions.filter((definition) => definition.parts.some((part) => part.stageSlug === item.stage.slug));
    if (!included.length) return [];
    const parts = included.flatMap((definition) => definition.parts.filter((part) => part.stageSlug === item.stage.slug));
    const removedStartKm = parts[0].fromKm;
    const removedEndKm = item.toKm - item.fromKm - parts[parts.length - 1].toKm;
    const partial = removedStartKm + removedEndKm > .01;
    const newStops = boundaries.slice(1, -1).filter((boundary) => boundary.km > item.fromKm + .001 && boundary.km < item.toKm - .001).map((boundary) => boundary.town);
    return [{ originalTitle: item.stage.title, originalDistanceKm: item.stage.distanceKm, newDays: included.map((definition) => definition.day), newStops, removedStartKm: Number(removedStartKm.toFixed(1)), removedEndKm: Number(Math.max(0, removedEndKm).toFixed(1)), kind: included.length > 1 ? 'split' : partial ? 'trim' : included[0].parts.length > 1 ? 'merge' : 'retained' }];
  });
  const changed = changes.some((change) => change.kind !== 'retained');
  const redesignDecisions = changes
    .filter((change) => change.kind === 'split' && !change.removedStartKm && !change.removedEndKm)
    .sort((left, right) => {
      const mixedDays = (change: typeof left) => dailyStages.filter((stage) => change.newDays.includes(stage.day) && stage.sourceParts.some((part) => part.title !== change.originalTitle)).length;
      return mixedDays(left) - mixedDays(right) || right.originalDistanceKm - left.originalDistanceKm;
    })
    .slice(0, 2)
    .map((change) => ({
      before: { title: change.originalTitle, distanceKm: change.originalDistanceKm },
      after: dailyStages.filter((stage) => change.newDays.includes(stage.day)).map((stage) => ({ day: stage.day, title: stage.title, distanceKm: stage.distanceKm, includesOtherStageParts: stage.sourceParts.some((part) => part.title !== change.originalTitle) })),
      newStops: change.newStops,
      reason: `${pace.reason} Repartir el esfuerzo de ${change.originalDistanceKm} km entre varios dias en vez de concentrarlo en una jornada, dentro de un viaje de ${days} dias y un objetivo orientativo de ${pace.targetKm} km por dia.`,
    }));
  const decision = redesignDecisions[0];
  const decisionEvidence = decision ? `Antes: ${decision.before.title}, ${decision.before.distanceKm} km en una jornada. Ahora: ${decision.after.map((stage) => `dia ${stage.day}, ${stage.title}, ${stage.distanceKm} km`).join('; ')}. Paradas nuevas dentro del tramo original: ${decision.newStops.join(', ')}.${decision.after.some((stage) => stage.includesOtherStageParts) ? ' Estas jornadas tambien incluyen partes de etapas contiguas; su distancia total no equivale solo al tramo original.' : ''} Motivo: ${decision.reason}` : undefined;
  return { stages: resolved, adaptation: {
    comparison: 'connected_source_path', travelMode: draft.travelMode, requestedDays: days, selectionReason: 'redistribute_days_and_pace',
    omittedBefore: offsets.filter((item) => item.toKm <= boundaries[0].km + .001).map((item) => describe(item.stage)),
    omittedAfter: offsets.filter((item) => item.fromKm >= boundaries[boundaries.length - 1].km - .001).map((item) => describe(item.stage)),
    retained: source.filter((stage) => changes.some((change) => change.originalTitle === stage.title && change.kind === 'retained')).map((stage) => ({ ...describe(stage), originalOrder: stage.order, day: definitions.find((definition) => definition.parts.some((part) => part.stageSlug === stage.slug))!.day, distanceKm: stage.distanceKm })),
    stageBoundariesChanged: changed, paceTargetKm: pace.targetKm, paceReason: pace.reason,
    startChange: boundaries[0].km > .01 ? { fromTown: source[0].startTown, toTown: boundaries[0].town, omittedKm: Number(boundaries[0].km.toFixed(1)) } : undefined,
    endChange: totalKm - boundaries[boundaries.length - 1].km > .01 ? { fromTown: source[source.length - 1].endTown, toTown: boundaries[boundaries.length - 1].town, omittedKm: Number((totalKm - boundaries[boundaries.length - 1].km).toFixed(1)) } : undefined,
    originalStages: source.filter((stage) => changes.some((change) => change.originalTitle === stage.title)).map((stage) => ({ title: stage.title, distanceKm: stage.distanceKm })), dailyStages, changes, redesignDecisions,
    explanation: decisionEvidence ?? `Recorrido de ${boundaries[0].town} a ${boundaries[boundaries.length - 1].town} repartido en ${days} jornadas entre localidades cartografiadas. ${pace.reason} Objetivo orientativo: ${pace.targetKm} km/dia. Se equilibra el esfuerzo usando la dificultad del catalogo; no se garantiza alojamiento ni seguridad.`,
  } };
};