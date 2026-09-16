import type { DecisionContext, DecisionOutput, DecisionRecommendation } from './decisionTypes';

const createId = (type: string, suffix: string) => `decision:${type}:${suffix}`;

const createEvidence = (context: DecisionContext, sourceId: string, confidence: 'alta' | 'media' | 'baja' = 'media') => ({
  sourceType: 'calculation' as const,
  sourceId,
  generatedAtIso: context.timestampIso,
  confidence,
});

const byPriority = (left: DecisionRecommendation, right: DecisionRecommendation) => {
  const rank = { critica: 4, alta: 3, media: 2, baja: 1 };
  return rank[right.priority] - rank[left.priority];
};

export class DeterministicDecisionEngine {
  evaluate(context: DecisionContext): DecisionOutput {
    const recommendations: DecisionRecommendation[] = [];

    for (const milestone of [25, 50, 75, 100]) {
      if (!context.activeStage || context.physical.progressPercent < milestone) continue;
      recommendations.push({
        id: `milestone:${milestone}`,
        type: 'tracking',
        priority: milestone === 100 ? 'alta' : 'media',
        title: milestone === 100 ? 'Has llegado al final de la etapa' : `${milestone}% del camino de hoy`,
        message: milestone === 100
          ? `Ya estas en ${context.activeStage.endTown}. Cierra la etapa para guardar tu diario y recoger tu recompensa.`
          : `Llevas ${context.physical.completedDistanceKm.toFixed(1)} km. ${milestone === 50 ? 'Buen momento para hacer una pausa y revisar el agua.' : `Quedan ${context.physical.remainingKm.toFixed(1)} km hasta ${context.activeStage.endTown}.`}`,
        actionLabel: milestone === 100 ? 'Cerrar etapa' : 'Ver progreso',
        actionType: 'notificar',
        evidence: [createEvidence(context, `stage-milestone:${milestone}`, 'alta')],
        createdAtIso: context.timestampIso,
      });
    }

    if (!context.activeStage) {
      recommendations.push({
        id: createId('tracking', 'sin-etapa'),
        type: 'tracking',
        priority: 'alta',
        title: 'Selecciona una etapa activa',
        message: 'No hay una etapa activa para calcular progreso. Revisa tu campana antes de iniciar tracking.',
        actionLabel: 'Revisar campana',
        actionType: 'mostrar',
        evidence: [createEvidence(context, 'missing-active-stage', 'alta')],
        createdAtIso: context.timestampIso,
      });
    }

    if (context.physical.batteryPercent !== undefined && context.physical.batteryPercent <= 20) {
      recommendations.push({
        id: createId('seguridad', 'bateria-baja'),
        type: 'seguridad',
        priority: 'alta',
        title: 'Bateria baja',
        message: `Queda ${context.physical.batteryPercent}% de bateria. Reduce uso de pantalla y prioriza guardar ubicacion antes de seguir.`,
        actionLabel: 'Ahorrar bateria',
        actionType: 'notificar',
        evidence: [createEvidence(context, 'battery-low', 'alta')],
        createdAtIso: context.timestampIso,
      });
    }

    if (context.weather?.precipitationProbability !== undefined && context.weather.precipitationProbability >= 60) {
      recommendations.push({
        id: createId('seguridad', 'lluvia'),
        type: 'seguridad',
        priority: context.weather.alertLevel === 'orange' || context.weather.alertLevel === 'red' ? 'critica' : 'alta',
        title: 'Lluvia probable',
        message: context.weather.rainEtaMinutes
          ? `Probabilidad de lluvia del ${context.weather.precipitationProbability}% en unos ${context.weather.rainEtaMinutes} min. Revisa chubasquero y proxima parada cubierta.`
          : `Probabilidad de lluvia del ${context.weather.precipitationProbability}%. Revisa chubasquero y proxima parada cubierta.`,
        actionLabel: 'Ver servicios cercanos',
        actionType: 'notificar',
        evidence: [context.weather.evidence],
        createdAtIso: context.timestampIso,
      });
    }

    if (context.physical.progressPercent >= 75 && context.physical.remainingKm > 0) {
      recommendations.push({
        id: createId('alojamiento', 'ultimo-tercio'),
        type: 'alojamiento',
        priority: 'media',
        title: 'Ultimo tercio de etapa',
        message: `Quedan ${context.physical.remainingKm.toFixed(1)} km. Buen momento para revisar alojamiento, compra o cena antes de llegar.`,
        actionLabel: 'Abrir Descubrir',
        actionType: 'mostrar',
        evidence: [createEvidence(context, 'stage-last-quarter')],
        createdAtIso: context.timestampIso,
      });
    }

    const nearest = context.nearby[0];
    if (nearest && nearest.distanceKm <= 0.8) {
      recommendations.push({
        id: createId(nearest.type, nearest.id),
        type: nearest.type === 'monument' || nearest.type === 'stagePoint' ? 'cultural' : 'descanso',
        priority: 'baja',
        title: nearest.type === 'monument' ? 'Patrimonio cercano' : 'Servicio cercano',
        message: `${nearest.title} esta a ${nearest.distanceKm.toFixed(2)} km. Encaja como parada breve si tienes margen.`,
        actionLabel: 'Ver detalle',
        actionType: 'crear_quest',
        evidence: [nearest.evidence],
        createdAtIso: context.timestampIso,
      });
    }

    return {
      schemaVersion: '1.0',
      generatedAtIso: context.timestampIso,
      recommendations: recommendations.sort(byPriority),
      discardedRecommendations: [],
    };
  }
}
