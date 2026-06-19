import type { TravelMode } from '../camino';
import type { BudgetMode, PilgrimClass } from '../user';

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
  }>;
  globalAdvice: string[];
  requiresUserChoice: boolean;
};
