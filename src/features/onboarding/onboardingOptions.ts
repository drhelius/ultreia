import type { BudgetMode, PilgrimClass, TravelMode } from '../../domain';
import type { CampaignGoal } from './onboardingTypes';

export type OnboardingOption<TValue extends string | number> = {
  label: string;
  value: TValue;
};

export const pilgrimClassOptions: OnboardingOption<PilgrimClass>[] = [
  { label: 'Tranquilo', value: 'tranquilo' },
  { label: 'Deportista', value: 'deportista' },
  { label: 'Cultural', value: 'cultural' },
  { label: 'Religioso', value: 'religioso' },
  { label: 'Gastronomico', value: 'gastronomico' },
  { label: 'Fotografico', value: 'fotografico' },
  { label: 'Completista', value: 'completista' },
];

export const travelModeOptions: OnboardingOption<TravelMode>[] = [
  { label: 'A pie', value: 'walk' },
  { label: 'En bici', value: 'bike' },
  { label: 'En coche', value: 'car' },
];

export const dayOptions: OnboardingOption<number>[] = [
  { label: '3 dias', value: 3 },
  { label: '5 dias', value: 5 },
  { label: '7 dias', value: 7 },
  { label: '10 dias', value: 10 },
  { label: '15 dias', value: 15 },
  { label: '21 dias', value: 21 },
  { label: '30 dias', value: 30 },
];

export const budgetModeOptions: OnboardingOption<BudgetMode>[] = [
  { label: 'Austero', value: 'austero' },
  { label: 'Equilibrado', value: 'equilibrado' },
  { label: 'Comodo', value: 'comodo' },
];

export const goalOptions: OnboardingOption<CampaignGoal>[] = [
  { label: 'Llegar a Santiago', value: 'llegar_a_santiago' },
  { label: 'Compostela minima', value: 'compostela_minima' },
  { label: 'Ruta completa', value: 'ruta_completa' },
  { label: 'Naturaleza', value: 'naturaleza' },
  { label: 'Patrimonio', value: 'patrimonio' },
  { label: 'Baja dificultad', value: 'baja_dificultad' },
  { label: 'Evitar masificacion', value: 'evitar_masificacion' },
];
