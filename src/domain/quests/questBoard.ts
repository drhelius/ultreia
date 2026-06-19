import type { CaminoService, CaminoStage, DecisionRecommendation, Monument, QuestBoard, QuestBoardItem, StagePoint } from '..';

const createMainQuest = (stage: CaminoStage): QuestBoardItem => ({
  id: `quest:main:${stage.slug}`,
  title: `Completa ${stage.title}`,
  kind: 'main',
  stageSlug: stage.slug,
  description: `Llega al final de etapa, registra tu experiencia y prepara la siguiente jornada. Distancia: ${stage.distanceKm} km.`,
});

const pointQuest = (stageSlug: string, point: StagePoint): QuestBoardItem => ({
  id: `quest:point:${point.id}`,
  title: point.type === 'monumento' ? `Descubre ${point.title}` : `Explora ${point.title}`,
  kind: 'side',
  stageSlug,
  description: point.shortDescription || 'Punto de interes registrado en esta etapa.',
  linkedEntityId: point.id,
});

const monumentQuest = (stageSlug: string, monument: Monument): QuestBoardItem => ({
  id: `quest:monument:${monument.id}`,
  title: `Visita ${monument.title}`,
  kind: 'side',
  stageSlug,
  description: monument.shortStory,
  linkedEntityId: monument.id,
});

const serviceQuest = (stageSlug: string, service: CaminoService): QuestBoardItem => ({
  id: `quest:service:${service.id}`,
  title: service.type === 'albergue' ? 'Revisa opciones de descanso' : `Localiza ${service.title}`,
  kind: service.type === 'farmacia' || service.type === 'centro_salud' ? 'safety' : 'side',
  stageSlug,
  description: `${service.title} esta registrado en el data pack para esta etapa.`,
  linkedEntityId: service.id,
});

const recommendationQuest = (stageSlug: string, recommendation: DecisionRecommendation): QuestBoardItem => ({
  id: `quest:decision:${recommendation.id}`,
  title: recommendation.title,
  kind: recommendation.type === 'seguridad' || recommendation.priority === 'critica' ? 'safety' : 'side',
  stageSlug,
  description: recommendation.message,
  recommendationId: recommendation.id,
});

export const buildQuestBoard = ({
  stage,
  stagePoints,
  monuments,
  services,
  recommendations,
}: {
  stage: CaminoStage;
  stagePoints: StagePoint[];
  monuments: Monument[];
  services: CaminoService[];
  recommendations: DecisionRecommendation[];
}): QuestBoard => {
  const sideQuests = [
    ...monuments.slice(0, 2).map((monument) => monumentQuest(stage.slug, monument)),
    ...stagePoints.filter((point) => point.type === 'monumento' || point.type === 'punto').slice(0, 3).map((point) => pointQuest(stage.slug, point)),
    ...services.filter((service) => service.type === 'albergue' || service.type === 'monumento').slice(0, 2).map((service) => serviceQuest(stage.slug, service)),
    ...recommendations.filter((recommendation) => recommendation.type !== 'seguridad').slice(0, 2).map((recommendation) => recommendationQuest(stage.slug, recommendation)),
  ];
  const safetyQuests = [
    ...services.filter((service) => service.type === 'farmacia' || service.type === 'centro_salud').slice(0, 3).map((service) => serviceQuest(stage.slug, service)),
    ...recommendations.filter((recommendation) => recommendation.type === 'seguridad' || recommendation.priority === 'critica').slice(0, 3).map((recommendation) => recommendationQuest(stage.slug, recommendation)),
  ];

  return {
    stageSlug: stage.slug,
    mainQuest: createMainQuest(stage),
    sideQuests,
    safetyQuests,
    recommendations,
  };
};
