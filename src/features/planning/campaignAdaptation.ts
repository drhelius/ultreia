import type { CaminoStage } from '../../domain';
import type { PlanningStageAdaptation } from '../../domain/ai/planningAgentTypes';
import type { OnboardingDraft } from '../onboarding/onboardingTypes';

export function describeStageAdaptation(source: CaminoStage[], selected: CaminoStage[], draft: OnboardingDraft, comparison: PlanningStageAdaptation['comparison'] = 'connected_source_path'): PlanningStageAdaptation {
  const startIndex = source.findIndex((stage) => stage.slug === selected[0]?.slug);
  if (!selected.length || startIndex < 0 || selected.some((stage, index) => source[startIndex + index]?.slug !== stage.slug)) throw new Error('La adaptacion debe corresponder a etapas consecutivas del recorrido de origen.');
  const before = source.slice(0, startIndex);
  const after = source.slice(startIndex + selected.length);
  const describeStage = (stage: CaminoStage) => ({ slug: stage.slug, title: stage.title, order: stage.order });
  const consecutiveOrders = (stages: CaminoStage[]) => stages.every((stage, index) => stage.order === stages[0].order + index);
  const stageRange = (stages: CaminoStage[]) => stages.length === 1
    ? `la etapa ${stages[0].order} (${stages[0].title})`
    : `${consecutiveOrders(stages) ? `las etapas ${stages[0].order}-${stages[stages.length - 1].order}` : `${stages.length} etapas`} (${stages[0].title} hasta ${stages[stages.length - 1].title})`;
  const selectionReason = comparison === 'selected_catalog_stages' ? 'existing_template' : before.length ? 'fit_days_keep_arrival' : after.length ? 'fit_days_from_start' : 'keep_full_path';
  const omission = before.length ? `Se omiten ${stageRange(before)} para reservar tus ${draft.availableDays} dias al tramo que termina en ${selected[selected.length - 1].endTown}.`
    : after.length ? `Se dejan fuera ${stageRange(after)} para ajustar el recorrido desde ${selected[0].startTown} a tus ${draft.availableDays} dias.`
    : comparison === 'connected_source_path' ? 'Se conserva el recorrido de origen completo, sin omitir etapas.' : 'Se conservan las etapas de esta campana del catalogo.';
  const first = selected[0];
  const last = selected[selected.length - 1];
  const distribution = draft.travelMode === 'car' ? `Se agrupan hasta tres tramos por dia para la visita en coche, sin cambiar sus extremos.` : 'No se divide, fusiona ni acorta ninguna etapa.';
  const retained = selected.map((stage, index) => ({ slug: stage.slug, title: stage.title, originalOrder: stage.order, day: draft.travelMode === 'car' ? Math.floor(index / 3) + 1 : index + 1, distanceKm: stage.distanceKm }));
  const kept = selected.length === 1 ? `Se mantiene ${first.title} (${first.distanceKm} km).`
    : `Se mantienen ${consecutiveOrders(selected) ? `las etapas ${first.order}-${last.order}` : `${selected.length} etapas`}: ${first.startTown} a ${last.endTown}, sin alterar sus paradas.${draft.travelMode === 'car' ? '' : ` ${first.title} es el dia 1.`}`;
  return {
    comparison, travelMode: draft.travelMode, requestedDays: draft.availableDays, selectionReason,
    omittedBefore: before.map(describeStage), omittedAfter: after.map(describeStage), retained,
    stageBoundariesChanged: false,
    explanation: `${omission} ${kept} ${distribution}`,
  };
}