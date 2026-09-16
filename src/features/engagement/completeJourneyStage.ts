import type { ActiveJourney, CampaignPlan, CaminoStage, TrackingSample, UserProfile } from '../../domain';
import type { JourneyRepository, ProgressionRepository, JournalRepository, TrackingRepository } from '../../repositories';

type Repositories = { journeyRepository: JourneyRepository; progressionRepository: ProgressionRepository; journalRepository: JournalRepository; trackingRepository: TrackingRepository };

export async function completeJourneyStage({ repositories, journey, campaign, stage, profile, samples, distanceKm, nowIso }: {
  repositories: Repositories; journey: ActiveJourney; campaign: CampaignPlan; stage: CaminoStage; profile: UserProfile; samples: TrackingSample[]; distanceKm: number; nowIso: string;
}): Promise<ActiveJourney> {
  const persisted = await repositories.journeyRepository.getActiveJourney();
  if (!persisted || persisted.id !== journey.id) throw new Error('El Camino activo ha cambiado.');
  if (persisted.status === 'completed' || persisted.activeStageSlug !== stage.slug) return persisted;
  const index = campaign.stageSlugs.indexOf(stage.slug);
  if (index < 0) throw new Error('La etapa no pertenece a esta campana.');
  const simulated = samples.some((sample) => sample.evidence.simulated);
  const entryId = `journal:${journey.id}:${stage.slug}`;
  if (!await repositories.journalRepository.getEntry(entryId)) {
    await repositories.journalRepository.saveEntry({ id: entryId, journeyId: journey.id, stageSlug: stage.slug, dateIso: nowIso, status: 'draft', title: `${stage.startTown} a ${stage.endTown}`, body: `${simulated ? 'Recorrido de demostracion.\n\n' : ''}Hoy he completado la etapa de ${stage.startTown} a ${stage.endTown}. ${distanceKm.toFixed(1)} km registrados.\n\n${stage.summary}\n\nMi recuerdo del dia:`, updatedAtIso: nowIso });
  }
  await repositories.journeyRepository.saveStageProgress({ journeyId: journey.id, stageSlug: stage.slug, state: 'completada', completedAtIso: nowIso, distanceKm, evidence: { sourceType: 'user_input', sourceId: 'complete-stage', generatedAtIso: nowIso, confidence: 'alta', simulated } });
  const achievements = await repositories.progressionRepository.getAchievementStates(profile.id);
  if (!achievements.some((achievement) => achievement.achievementId === 'achievement:primera-etapa' && achievement.unlockedAtIso)) {
    await repositories.progressionRepository.saveAchievementState({ id: `achievement-state:${profile.id}:achievement:primera-etapa`, userId: profile.id, achievementId: 'achievement:primera-etapa', unlockedAtIso: nowIso, progress: 1 });
  }
  const session = await repositories.trackingRepository.getActiveSession(journey.id);
  if (session) await repositories.trackingRepository.saveSession({ ...session, status: 'completed', endedAtIso: nowIso });
  const nextSlug = campaign.stageSlugs[index + 1];
  if (!nextSlug && stage.endTown.toLowerCase().includes('santiago')) {
    const progress = await repositories.journeyRepository.getStageProgress(journey.id);
    const totalKm = progress.reduce((sum, item) => sum + (item.distanceKm ?? 0), 0);
    const minimumKm = campaign.travelMode === 'bike' ? 200 : 100;
    if (campaign.travelMode !== 'car' && totalKm >= minimumKm) await repositories.progressionRepository.saveAchievementState({ id: `achievement-state:${profile.id}:achievement:compostela`, userId: profile.id, achievementId: 'achievement:compostela', progress: 1, unlockedAtIso: nowIso });
  }
  if (nextSlug) await repositories.journeyRepository.saveStageProgress({ journeyId: journey.id, stageSlug: nextSlug, state: 'activa' });
  const nextJourney: ActiveJourney = { ...persisted, activeStageSlug: nextSlug ?? stage.slug, status: nextSlug ? 'active' : 'completed', updatedAtIso: nowIso };
  await repositories.journeyRepository.saveActiveJourney(nextJourney);
  return nextJourney;
}