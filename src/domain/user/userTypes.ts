import type { DateIso, Locale } from '../../core';
import type { TravelMode } from '../camino';

export type PilgrimClass =
  | 'tranquilo'
  | 'deportista'
  | 'cultural'
  | 'religioso'
  | 'gastronomico'
  | 'fotografico'
  | 'completista';

export type BudgetMode = 'austero' | 'equilibrado' | 'comodo';

export type UserProfile = {
  id: string;
  displayName: string;
  locale: Locale;
  pilgrimClass: PilgrimClass;
  pilgrimClasses: PilgrimClass[];
  travelMode: TravelMode;
  budgetMode: BudgetMode;
  createdAtIso: DateIso;
  updatedAtIso: DateIso;
};

export type UserPreferences = {
  userId: string;
  notificationTolerance: 'baja' | 'normal' | 'alta';
  allowLocationTracking: boolean;
  allowCommunityFeatures: boolean;
};
