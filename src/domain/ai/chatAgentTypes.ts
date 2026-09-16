import type { ChatAssistantAction, ChatMessage } from '../chat';
import type { BudgetMode, PilgrimClass } from '../user';
import type { Coordinates, Evidence } from '../../core';
import type { ServiceType } from '../camino';
import type { WeatherSnapshot } from '../realtime';
import type { UserPreferences } from '../user';

export type ChatNearbyPlace = {
  id: string;
  title: string;
  type: ServiceType;
  distanceKm: number;
  distanceKind: 'straight_line';
  coordinate: Coordinates;
  address?: string;
  phone?: string;
  openingHoursText?: string;
  availability: 'unknown';
  stageSlug?: string;
  evidence: Evidence[];
};

export type ChatAgentContext = {
  generatedAtIso?: string;
  localDate?: string;
  timeZone?: string;
  user: {
    displayName: string;
    pilgrimClasses: PilgrimClass[];
    travelMode: string;
    budgetMode: BudgetMode;
    preferences?: Pick<UserPreferences, 'notificationTolerance' | 'allowLocationTracking' | 'allowCommunityFeatures'>;
  };
  journey: {
    routeSlug?: string;
    campaignTitle?: string;
    activeStageSlug?: string;
    status?: string;
    activeStageNumber?: number;
    totalStages?: number;
    completedStages?: number;
    itinerary?: Array<{ stageSlug: string; title: string; distanceKm: number; state: string }>;
  };
  activeStage?: {
    title: string;
    startTown: string;
    endTown: string;
    distanceKm: number;
    difficulty: string;
    summary: string;
  };
  tracking: {
    currentLocation?: Coordinates;
    simulated?: boolean;
    progressPercent?: number;
    remainingKm?: number;
    completedDistanceKm?: number;
    etaMinutes?: number;
    distanceScope?: 'active_stage';
    elapsedMinutes?: number;
    totalKm?: number;
    batteryPercent?: number;
    deviationKm?: number;
    sessionStatus?: string;
    locationStatus?: string;
  };
  nearby: Array<{
    id: string;
    title: string;
    type: string;
    distanceKm: number;
    distanceKind?: 'straight_line';
  }>;
  serviceSearch?: {
    status: 'available' | 'location_unavailable';
    source: 'local_data_pack';
    scope: 'all_imported_routes';
    coverage: 'partial';
    radiusKm: number;
    limitPerCategory: number;
    origin?: Coordinates;
    requestedTypes?: ServiceType[];
    requestedMatches?: number;
    requestedStatus?: 'found' | 'not_found_in_catalog' | 'not_searched';
    totalMatches: number;
    categories: Array<{ type: ServiceType; matches: number; returned: number }>;
    places: ChatNearbyPlace[];
  };
  stageDetails?: {
    scope: 'active_stage';
    source: 'local_data_pack';
    sourceStageSlugs: string[];
    itinerarySummary: string;
    difficultyNotes: string[];
    observations: string[];
    whatToSee: string[];
  };
  weather?: WeatherSnapshot;
  budget?: {
    currency: 'EUR';
    dailyTargetEur?: number;
    estimatedTotalEur?: number;
    spentTodayEur: number;
    spentJourneyEur: number;
    remainingEstimatedEur?: number;
  };
  dataLimits?: string[];
  recommendations: Array<{
    title: string;
    priority: string;
    message: string;
    createdAtIso?: string;
    stageSlug?: string;
    origin?: 'local' | 'foundry';
  }>;
};

export type ChatAgentInput = {
  schemaVersion: '1.0';
  locale: 'es-ES';
  userMessage: string;
  conversation: ChatMessage[];
  context: ChatAgentContext;
};

export type ChatAgentOutput = {
  schemaVersion: '1.0';
  answer: string;
  actions: ChatAssistantAction[];
  usedContext: string[];
};
