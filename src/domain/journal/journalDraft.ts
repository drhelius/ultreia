import type { CaminoStage, JournalEntry, QuestState, TrackingSample } from '..';

export const createJournalDraft = ({
  id,
  journeyId,
  stage,
  samples,
  completedQuestStates,
  nowIso,
}: {
  id: string;
  journeyId: string;
  stage: CaminoStage;
  samples: TrackingSample[];
  completedQuestStates: QuestState[];
  nowIso: string;
}): JournalEntry => {
  const firstSample = samples[0];
  const lastSample = samples.at(-1);
  const bodyLines = [
    `Etapa: ${stage.title}`,
    `Distancia oficial: ${stage.distanceKm} km`,
    firstSample && lastSample ? `Tracking registrado entre ${firstSample.recordedAtIso} y ${lastSample.recordedAtIso}.` : 'Tracking pendiente de completar.',
    completedQuestStates.length > 0 ? `Quests completadas: ${completedQuestStates.length}.` : 'Sin quests completadas todavia.',
  ];

  return {
    id,
    journeyId,
    stageSlug: stage.slug,
    dateIso: nowIso.slice(0, 10),
    status: 'draft',
    title: `Diario de ${stage.title}`,
    body: bodyLines.join('\n'),
    updatedAtIso: nowIso,
  };
};
