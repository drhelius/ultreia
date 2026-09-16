import type { BudgetMode, PilgrimClass, TravelMode } from '../../domain';

export type CampaignGoal =
  | 'llegar_a_santiago'
  | 'compostela_minima'
  | 'ruta_completa'
  | 'naturaleza'
  | 'patrimonio'
  | 'baja_dificultad'
  | 'evitar_masificacion';

export type OnboardingDraft = {
  displayName: string;
  pilgrimClasses: PilgrimClass[];
  travelMode: TravelMode;
  availableDays: number;
  budgetMode: BudgetMode;
  goal: CampaignGoal;
  avoidCrowds: boolean;
  additionalRequirements?: string;
};

export type OnboardingStep = 'profile' | 'mode' | 'classes' | 'availability' | 'goal' | 'budget' | 'requirements' | 'planning' | 'recommendations';
