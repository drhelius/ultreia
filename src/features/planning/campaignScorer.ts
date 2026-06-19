import type { Evidence } from '../../core';
import type { BudgetProfile, CaminoRoute, CaminoStage } from '../../domain';
import type { CampaignTemplate } from '../../repositories';
import type { OnboardingDraft } from '../onboarding/onboardingTypes';

export type CampaignRecommendation = {
  campaign: CampaignTemplate;
  route: CaminoRoute;
  stages: CaminoStage[];
  score: number;
  fitScore: number;
  totalKm: number;
  estimatedDays: number;
  dailyKm: number;
  difficulty: CaminoStage['difficulty'];
  budgetEstimateEur: number;
  reasons: string[];
  risks: string[];
  evidence: Evidence[];
};

const difficultyRank: Record<CaminoStage['difficulty'], number> = {
  baja: 1,
  media: 2,
  alta: 3,
};

const maxDifficulty = (stages: CaminoStage[]): CaminoStage['difficulty'] => {
  return stages.reduce<CaminoStage['difficulty']>((current, stage) => (difficultyRank[stage.difficulty] > difficultyRank[current] ? stage.difficulty : current), 'baja');
};

const normalizeText = (value: string): string => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const goalScore = (draft: OnboardingDraft, campaign: CampaignTemplate, route: CaminoRoute): number => {
  const title = normalizeText(`${campaign.title} ${route.title}`);

  if (draft.goal === 'compostela_minima' && title.includes('sarria')) return 24;
  if (draft.goal === 'ruta_completa' && title.includes('epica')) return 24;
  if (draft.goal === 'patrimonio' && (title.includes('frances') || title.includes('ingles'))) return 14;
  if (draft.goal === 'naturaleza' && (title.includes('primitivo') || title.includes('norte'))) return 14;
  if (draft.goal === 'baja_dificultad' && campaign.recommendedDays <= 7) return 12;
  if (draft.goal === 'evitar_masificacion' && !title.includes('sarria')) return 12;

  return draft.goal === 'llegar_a_santiago' && route.endTown.toLowerCase().includes('santiago') ? 12 : 0;
};

const classScore = (draft: OnboardingDraft, campaign: CampaignTemplate, stages: CaminoStage[]): number => {
  const title = normalizeText(campaign.title);
  const difficulty = maxDifficulty(stages);
  const classes = new Set(draft.pilgrimClasses);
  let score = 0;

  if (classes.has('deportista')) score += difficulty === 'alta' || stages.length >= 10 ? 12 : 4;
  if (classes.has('tranquilo')) score += difficulty === 'baja' || campaign.recommendedDays <= 7 ? 14 : -8;
  if (classes.has('cultural')) score += title.includes('frances') || title.includes('ingles') ? 12 : 4;
  if (classes.has('fotografico')) score += title.includes('norte') || title.includes('fisterra') ? 12 : 5;
  if (classes.has('gastronomico')) score += title.includes('portugues') || title.includes('frances') ? 10 : 4;
  if (classes.has('completista')) score += stages.length >= 10 ? 12 : 4;
  if (classes.has('religioso')) score += title.includes('frances') || title.includes('fisterra') ? 10 : 4;

  return score || 8;
};

export const scoreCampaign = ({
  campaign,
  route,
  stages,
  draft,
  budgetProfile,
}: {
  campaign: CampaignTemplate;
  route: CaminoRoute;
  stages: CaminoStage[];
  draft: OnboardingDraft;
  budgetProfile: BudgetProfile;
}): CampaignRecommendation => {
  const totalKm = Number(stages.reduce((sum, stage) => sum + stage.distanceKm, 0).toFixed(1));
  const estimatedDays = draft.travelMode === 'bike' ? Math.max(1, stages.length) : draft.travelMode === 'car' ? Math.max(1, Math.ceil(campaign.recommendedDays / 3)) : campaign.recommendedDays;
  const dailyKm = Number((totalKm / Math.max(1, estimatedDays)).toFixed(1));
  const dayDelta = Math.abs(estimatedDays - draft.availableDays);
  const dayScore = Math.max(0, 30 - dayDelta * 4);
  const modeScore = draft.travelMode === 'bike' ? (stages.some((stage) => stage.variantGroup === 'bici') ? 18 : -30) : draft.travelMode === 'car' ? 6 : 10;
  const score = dayScore + modeScore + goalScore(draft, campaign, route) + classScore(draft, campaign, stages) - (draft.avoidCrowds && campaign.title.toLowerCase().includes('sarria') ? 10 : 0);
  const difficulty = maxDifficulty(stages);
  const risks: string[] = [];

  if (difficulty === 'alta') risks.push('Incluye etapas de dificultad alta.');
  if (dailyKm > (draft.travelMode === 'bike' ? 70 : draft.travelMode === 'car' ? 180 : 28)) risks.push('Exige jornadas largas para tu disponibilidad.');
  if (draft.avoidCrowds && campaign.title.toLowerCase().includes('sarria')) risks.push('Puede estar concurrida en temporada alta.');

  const reasons = [
    `Encaja con ${estimatedDays} dias estimados frente a tus ${draft.availableDays} dias.`,
    `Usa ${stages.length} etapas del data pack local con ${totalKm} km totales.`,
    `Presupuesto estimado en modo ${budgetProfile.mode}: ${budgetProfile.dailyTargetEur * estimatedDays} EUR.`,
  ];

  if (draft.travelMode === 'bike') reasons.push('Usa etapas ciclistas cuando la ruta las ofrece.');
  if (draft.travelMode === 'car') reasons.push('Adaptada como ruta escenica en coche usando etapas y paradas del data pack.');

  return {
    campaign,
    route,
    stages,
    score,
    fitScore: Math.max(0, Math.min(1, score / 90)),
    totalKm,
    estimatedDays,
    dailyKm,
    difficulty,
    budgetEstimateEur: budgetProfile.dailyTargetEur * estimatedDays,
    reasons,
    risks,
    evidence: [
      { sourceType: 'data_pack', sourceId: campaign.id, generatedAtIso: new Date().toISOString(), confidence: 'alta' },
      { sourceType: 'calculation', sourceId: `score:${campaign.id}`, generatedAtIso: new Date().toISOString(), confidence: 'media' },
      { sourceType: 'user_input', sourceId: 'onboarding', generatedAtIso: new Date().toISOString(), confidence: 'alta' },
    ],
  };
};
