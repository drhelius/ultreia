import type { DateIso, Evidence } from '../../core';
import type { TravelMode } from '../camino';

export type JourneyStatus = 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';

export type CampaignPlan = {
  id: string;
  title: string;
  routeSlug: string;
  stageSlugs: string[];
  travelMode: TravelMode;
  recommendedDays: number;
};

export type ActiveJourney = {
  id: string;
  userId: string;
  campaignId: string;
  routeSlug: string;
  activeStageSlug?: string;
  status: JourneyStatus;
  startedAtIso?: DateIso;
  updatedAtIso: DateIso;
};

export type StageProgress = {
  journeyId: string;
  stageSlug: string;
  state: 'bloqueada' | 'futura' | 'activa' | 'en_pausa' | 'completada' | 'saltada' | 'replanificada';
  completedAtIso?: DateIso;
  evidence?: Evidence;
};
