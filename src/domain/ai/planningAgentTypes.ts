import type { TravelMode } from '../camino';
import type { BudgetMode, PilgrimClass } from '../user';

export type PlanningStageAdaptation = {
  comparison: 'connected_source_path' | 'selected_catalog_stages';
  travelMode: TravelMode;
  requestedDays: number;
  selectionReason: 'fit_days_keep_arrival' | 'fit_days_from_start' | 'keep_full_path' | 'existing_template' | 'redistribute_days_and_pace';
  omittedBefore: Array<{ slug: string; title: string; order: number }>;
  omittedAfter: Array<{ slug: string; title: string; order: number }>;
  retained: Array<{ slug: string; title: string; originalOrder: number; day: number; distanceKm: number }>;
  stageBoundariesChanged: boolean;
  paceTargetKm?: number;
  paceReason?: string;
  startChange?: { fromTown: string; toTown: string; omittedKm: number };
  endChange?: { fromTown: string; toTown: string; omittedKm: number };
  originalStages?: Array<{ title: string; distanceKm: number }>;
  dailyStages?: Array<{ day: number; title: string; distanceKm: number; sourceParts: Array<{ title: string; fromKm: number; toKm: number; fullStage: boolean }> }>;
  changes?: Array<{ originalTitle: string; originalDistanceKm: number; newDays: number[]; newStops: string[]; removedStartKm?: number; removedEndKm?: number; kind: 'split' | 'merge' | 'trim' | 'retained' }>;
  redesignDecisions?: Array<{
    before: { title: string; distanceKm: number };
    after: Array<{ day: number; title: string; distanceKm: number; includesOtherStageParts: boolean }>;
    newStops: string[];
    reason: string;
  }>;
  explanation: string;
};

export type PlanningAgentCatalog = {
  generatedAtIso: string;
  routes: Array<{
    slug: string;
    title: string;
    subtitle: string;
    startTown: string;
    endTown: string;
    totalKm: number;
    walkingStageCount: number;
    cyclingStageCount: number;
    hostelCount: number;
    hasMonuments: boolean;
  }>;
  budgetProfiles: Array<{
    mode: BudgetMode;
    dailyTargetEur: number;
    notes: string[];
  }>;
  candidates: Array<{
    campaignId: string;
    title: string;
    routeSlug: string;
    fitScore: number;
    score: number;
    totalKm: number;
    estimatedDays: number;
    dailyKm: number;
    difficulty: string;
    budgetEstimateEur: number;
    reasons: string[];
    risks: string[];
    stageAdaptation?: PlanningStageAdaptation;
    routeSelection?: {
      startTown: string;
      endTown: string;
      stageCount: number;
      travelMode: TravelMode;
      variantGroups: string[];
      viaTowns: string[];
      startsAtBaseOrigin: boolean;
      endsAtBaseDestination: boolean;
    };
    route: {
      title: string;
      subtitle: string;
      startTown: string;
      endTown: string;
      totalKm: number;
    };
    stages: Array<{
      slug: string;
      order: number;
      title: string;
      startTown: string;
      endTown: string;
      distanceKm: number;
      difficulty: string;
      summary: string;
      itinerarySummary?: string;
      difficultyNotes: string[];
      observations: string[];
      whatToSee: string[];
      hostelTitles: string[];
      serviceTitles: string[];
      monumentTitles: string[];
      pointTitles: string[];
    }>;
  }>;
};

export type PlanningAgentInput = {
  schemaVersion: '1.0';
  locale: 'es-ES';
  user: {
    displayName: string;
    pilgrimClasses: PilgrimClass[];
    travelMode: TravelMode;
  };
  constraints: {
    availableDays: number;
    target: string;
    budgetMode: BudgetMode;
    avoidCrowds: boolean;
    additionalRequirements?: string;
  };
  deterministicRanking: Array<{
    campaignId: string;
    routeSlug: string;
    estimatedDays: number;
    totalKm: number;
    difficulty: string;
    budgetEstimateEur: number;
    reasons: string[];
    risks: string[];
  }>;
  catalog: PlanningAgentCatalog;
  explanationGuidance?: {
    format: 'single_paragraph';
    maxWords: number;
    instruction: string;
  };
};

export type PlanningAgentOutput = {
  schemaVersion: '1.0';
  summary: string;
  recommendations: Array<{
    campaignId: string;
    fitScore: number;
    reasons: string[];
    tradeoffs: string[];
    headline: string;
    rationale?: string;
  }>;
  globalAdvice: string[];
  requiresUserChoice: boolean;
};
